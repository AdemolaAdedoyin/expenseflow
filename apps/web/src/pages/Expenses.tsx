import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../auth/useCurrentUser';
import { api, money } from '../lib/api';
import {
  CreateExpensePayload,
  Expense,
  PaginatedExpenses,
  ReceiptDownload,
  ReceiptUploadTarget,
} from '../types/domain';

const expenseQueryKey = ['expenses'] as const;
const dashboardQueryKey = ['dashboard'] as const;
const acceptedReceiptTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const maxReceiptBytes = 10 * 1024 * 1024;

type CreateExpenseRequest = {
  payload: CreateExpensePayload;
  receipt?: File;
};

export default function Expenses() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [showForm, setShowForm] = useState(false);

  const canCreateExpenses = user?.role === 'EMPLOYEE';

  const { data, isLoading, error } = useQuery({
    queryKey: expenseQueryKey,
    queryFn: () => api<PaginatedExpenses>('/expenses'),
  });

  const createExpense = useMutation({
    mutationFn: async ({ payload, receipt }: CreateExpenseRequest) => {
      const expense = await api<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!receipt) {
        return expense;
      }

      const target = await api<ReceiptUploadTarget>(`/expenses/${expense.id}/receipt-upload`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: receipt.name,
          contentType: receipt.type,
          sizeBytes: receipt.size,
        }),
      });

      const uploadForm = new FormData();
      Object.entries(target.fields).forEach(([key, value]) => uploadForm.append(key, value));
      uploadForm.append('file', receipt);

      const uploadResponse = await fetch(target.uploadUrl, {
        method: 'POST',
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        throw new Error('The expense was saved, but the receipt upload failed.');
      }

      return api<Expense>(`/expenses/${expense.id}/receipt-upload/complete`, {
        method: 'POST',
        body: JSON.stringify({ objectKey: target.objectKey }),
      });
    },
    onSuccess: async () => {
      setShowForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: expenseQueryKey }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
      ]);
    },
  });

  const submitExpense = useMutation({
    mutationFn: (id: string) =>
      api<Expense>(`/expenses/${id}/submit`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: expenseQueryKey }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['approvals'] }),
      ]);
    },
  });

  const openReceipt = useMutation({
    mutationFn: (id: string) => api<ReceiptDownload>(`/expenses/${id}/receipt`),
    onSuccess: ({ downloadUrl }) => {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    },
  });

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const receiptValue = form.get('receipt');
    const receipt = receiptValue instanceof File && receiptValue.size > 0 ? receiptValue : undefined;

    if (receipt && !acceptedReceiptTypes.includes(receipt.type)) {
      createExpense.reset();
      window.alert('Receipt must be a JPEG, PNG, or PDF file.');
      return;
    }

    if (receipt && receipt.size > maxReceiptBytes) {
      createExpense.reset();
      window.alert('Receipt must be 10 MB or smaller.');
      return;
    }

    createExpense.mutate({
      payload: {
        merchant: String(form.get('merchant')),
        amountCents: Math.round(amount * 100),
        category: String(form.get('category')),
        description: String(form.get('description') ?? ''),
        incurredAt: new Date(String(form.get('incurredAt'))).toISOString(),
      },
      receipt,
    });
  }

  const mutationError = createExpense.error ?? submitExpense.error ?? openReceipt.error;

  return (
    <section>
      <div className="heading">
        <div>
          <h1>Expenses</h1>
          <p>
            {canCreateExpenses
              ? 'Create, submit and track your expenses.'
              : 'Review expense activity across the organization.'}
          </p>
        </div>

        {canCreateExpenses && (
          <button className="primary" type="button" onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Close form' : '+ New expense'}
          </button>
        )}
      </div>

      {canCreateExpenses && showForm && (
        <form className="panel formgrid" onSubmit={saveExpense}>
          <input name="merchant" placeholder="Merchant" required />
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required />
          <select name="category" defaultValue="Travel">
            <option>Travel</option>
            <option>Meals</option>
            <option>Software</option>
            <option>Office</option>
          </select>
          <input
            name="incurredAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <input className="wide" name="description" placeholder="Description" />
          <label className="wide receipt-field">
            <span>Receipt <small>optional · JPEG, PNG, or PDF · max 10 MB</small></span>
            <input name="receipt" type="file" accept="image/jpeg,image/png,application/pdf" />
          </label>
          <button className="primary" type="submit" disabled={createExpense.isPending}>
            {createExpense.isPending ? 'Saving...' : 'Save draft'}
          </button>
        </form>
      )}

      {(error || mutationError) && (
        <div className="error page-error">
          {(error ?? mutationError) instanceof Error
            ? (error ?? mutationError)?.message
            : 'Something went wrong while loading expenses.'}
        </div>
      )}

      <div className="panel table">
        <div className="tr th">
          <span>Merchant</span>
          <span>Category</span>
          <span>Amount</span>
          <span>Status</span>
          <span />
        </div>

        {isLoading && <div className="table-state">Loading expenses...</div>}

        {!isLoading && !data?.items.length && <div className="table-state">No expenses yet.</div>}

        {data?.items.map((expense) => (
          <div className="tr" key={expense.id}>
            <span>
              <b>{expense.merchant}</b>
              <small>{new Date(expense.incurredAt).toLocaleDateString()}</small>
            </span>
            <span>{expense.category}</span>
            <span>{money(expense.amountCents, expense.currency)}</span>
            <span>
              <em className={`status ${expense.status.toLowerCase()}`}>
                {expense.status.replaceAll('_', ' ')}
              </em>
            </span>
            <span className="expense-actions">
              {expense.receiptUrl && (
                <button
                  className="link"
                  type="button"
                  disabled={openReceipt.isPending}
                  onClick={() => openReceipt.mutate(expense.id)}
                >
                  Receipt
                </button>
              )}
              {canCreateExpenses && expense.status === 'DRAFT' && (
                <button
                  className="link"
                  type="button"
                  disabled={submitExpense.isPending}
                  onClick={() => submitExpense.mutate(expense.id)}
                >
                  Submit
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
