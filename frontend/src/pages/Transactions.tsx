// ===========================================
// NEXUS AI PLATFORM - TRANSACTIONS PAGE
// View and manage financial transactions
// ===========================================

import { useState, useEffect } from 'react';

interface Transaction {
    id: string;
    user_id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    currency: string;
    description: string;
    transaction_date: string;
    created_at: string;
}

interface TransactionSummary {
    byCategory: Array<{
        type: string;
        category: string;
        count: number;
        total: number;
        average: number;
    }>;
    totals: {
        total_income: number;
        total_expense: number;
        total_transactions: number;
    };
}

const API_BASE = (import.meta.env.VITE_API_URL || 'https://selfactual-api.azurewebsites.net') + '/api';

export function Transactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<TransactionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Transaction>>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTransaction, setNewTransaction] = useState({
        type: 'expense',
        category: '',
        amount: 0,
        description: '',
        transaction_date: new Date().toISOString().split('T')[0]
    });
    const [filter, setFilter] = useState({ type: '', category: '' });

    const categories = ['Software Subscription', 'Cloud Infrastructure', 'Office Supplies', 'Marketing', 'Consulting', 'Client Payment'];

    useEffect(() => {
        fetchTransactions();
        fetchSummary();
    }, [filter]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filter.type) params.append('type', filter.type);
            if (filter.category) params.append('category', filter.category);

            const response = await fetch(`${API_BASE}/transactions?${params}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await response.json();

            if (json.success) {
                setTransactions(json.data);
            } else {
                setError(json.error || 'Failed to fetch transactions');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const response = await fetch(`${API_BASE}/transactions/summary`, {
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await response.json();

            if (json.success) {
                setSummary(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch summary:', err);
        }
    };

    const handleCreate = async () => {
        try {
            const response = await fetch(`${API_BASE}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTransaction)
            });
            const json = await response.json();

            if (json.success) {
                setShowAddForm(false);
                setNewTransaction({
                    type: 'expense',
                    category: '',
                    amount: 0,
                    description: '',
                    transaction_date: new Date().toISOString().split('T')[0]
                });
                fetchTransactions();
                fetchSummary();
            } else {
                setError(json.error || 'Failed to create transaction');
            }
        } catch (err) {
            setError('Failed to create transaction');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            const response = await fetch(`${API_BASE}/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            const json = await response.json();

            if (json.success) {
                setEditingId(null);
                setEditForm({});
                fetchTransactions();
                fetchSummary();
            } else {
                setError(json.error || 'Failed to update transaction');
            }
        } catch (err) {
            setError('Failed to update transaction');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        try {
            const response = await fetch(`${API_BASE}/transactions/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await response.json();

            if (json.success) {
                fetchTransactions();
                fetchSummary();
            } else {
                setError(json.error || 'Failed to delete transaction');
            }
        } catch (err) {
            setError('Failed to delete transaction');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>💰 Financial Transactions</h1>
                <button
                    style={styles.addButton}
                    onClick={() => setShowAddForm(!showAddForm)}
                >
                    {showAddForm ? '✕ Cancel' : '+ Add Transaction'}
                </button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div style={styles.summaryGrid}>
                    <div style={{ ...styles.summaryCard, borderColor: '#10b981' }}>
                        <div style={styles.summaryLabel}>Total Income</div>
                        <div style={{ ...styles.summaryValue, color: '#10b981' }}>
                            {formatCurrency(Number(summary.totals.total_income) || 0)}
                        </div>
                    </div>
                    <div style={{ ...styles.summaryCard, borderColor: '#ef4444' }}>
                        <div style={styles.summaryLabel}>Total Expenses</div>
                        <div style={{ ...styles.summaryValue, color: '#ef4444' }}>
                            {formatCurrency(Number(summary.totals.total_expense) || 0)}
                        </div>
                    </div>
                    <div style={{ ...styles.summaryCard, borderColor: '#6366f1' }}>
                        <div style={styles.summaryLabel}>Net Balance</div>
                        <div style={{ ...styles.summaryValue, color: '#6366f1' }}>
                            {formatCurrency((Number(summary.totals.total_income) || 0) - (Number(summary.totals.total_expense) || 0))}
                        </div>
                    </div>
                    <div style={{ ...styles.summaryCard, borderColor: '#8b5cf6' }}>
                        <div style={styles.summaryLabel}>Total Transactions</div>
                        <div style={{ ...styles.summaryValue, color: '#8b5cf6' }}>
                            {summary.totals.total_transactions}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Transaction Form */}
            {showAddForm && (
                <div style={styles.formCard}>
                    <h3 style={styles.formTitle}>Add New Transaction</h3>
                    <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Type</label>
                            <select
                                style={styles.select}
                                value={newTransaction.type}
                                onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value })}
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Category</label>
                            <select
                                style={styles.select}
                                value={newTransaction.category}
                                onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                            >
                                <option value="">Select category...</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Amount ($)</label>
                            <input
                                style={styles.input}
                                type="number"
                                step="0.01"
                                value={newTransaction.amount}
                                onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Date</label>
                            <input
                                style={styles.input}
                                type="date"
                                value={newTransaction.transaction_date}
                                onChange={(e) => setNewTransaction({ ...newTransaction, transaction_date: e.target.value })}
                            />
                        </div>
                        <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
                            <label style={styles.label}>Description</label>
                            <input
                                style={styles.input}
                                type="text"
                                placeholder="Enter description..."
                                value={newTransaction.description}
                                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <button style={styles.saveButton} onClick={handleCreate}>
                        💾 Save Transaction
                    </button>
                </div>
            )}

            {/* Filters */}
            <div style={styles.filterBar}>
                <select
                    style={styles.filterSelect}
                    value={filter.type}
                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                >
                    <option value="">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
                <select
                    style={styles.filterSelect}
                    value={filter.category}
                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Error Message */}
            {error && (
                <div style={styles.error}>
                    ⚠️ {error}
                    <button style={styles.dismissError} onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div style={styles.loading}>Loading transactions...</div>
            ) : (
                /* Transactions Table */
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Type</th>
                                <th style={styles.th}>Category</th>
                                <th style={styles.th}>Description</th>
                                <th style={styles.th}>Amount</th>
                                <th style={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t) => (
                                <tr key={t.id} style={styles.tr}>
                                    {editingId === t.id ? (
                                        /* Edit Mode */
                                        <>
                                            <td style={styles.td}>
                                                <input
                                                    style={styles.editInput}
                                                    type="date"
                                                    value={editForm.transaction_date?.split('T')[0] || t.transaction_date.split('T')[0]}
                                                    onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })}
                                                />
                                            </td>
                                            <td style={styles.td}>
                                                <select
                                                    style={styles.editSelect}
                                                    value={editForm.type || t.type}
                                                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'income' | 'expense' })}
                                                >
                                                    <option value="income">Income</option>
                                                    <option value="expense">Expense</option>
                                                </select>
                                            </td>
                                            <td style={styles.td}>
                                                <select
                                                    style={styles.editSelect}
                                                    value={editForm.category || t.category}
                                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                >
                                                    {categories.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={styles.td}>
                                                <input
                                                    style={styles.editInput}
                                                    type="text"
                                                    value={editForm.description ?? t.description}
                                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                />
                                            </td>
                                            <td style={styles.td}>
                                                <input
                                                    style={styles.editInput}
                                                    type="number"
                                                    step="0.01"
                                                    value={editForm.amount ?? t.amount}
                                                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                                                />
                                            </td>
                                            <td style={styles.td}>
                                                <button style={styles.saveBtn} onClick={() => handleUpdate(t.id)}>✓</button>
                                                <button style={styles.cancelBtn} onClick={() => { setEditingId(null); setEditForm({}); }}>✕</button>
                                            </td>
                                        </>
                                    ) : (
                                        /* View Mode */
                                        <>
                                            <td style={styles.td}>{formatDate(t.transaction_date)}</td>
                                            <td style={styles.td}>
                                                <span style={{
                                                    ...styles.typeBadge,
                                                    backgroundColor: t.type === 'income' ? '#dcfce7' : '#fee2e2',
                                                    color: t.type === 'income' ? '#166534' : '#991b1b'
                                                }}>
                                                    {t.type === 'income' ? '↑' : '↓'} {t.type}
                                                </span>
                                            </td>
                                            <td style={styles.td}>{t.category}</td>
                                            <td style={styles.td}>{t.description}</td>
                                            <td style={{
                                                ...styles.td,
                                                ...styles.amount,
                                                color: t.type === 'income' ? '#10b981' : '#ef4444'
                                            }}>
                                                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                            <td style={styles.td}>
                                                <button style={styles.editBtn} onClick={() => { setEditingId(t.id); setEditForm(t); }}>✏️</button>
                                                <button style={styles.deleteBtn} onClick={() => handleDelete(t.id)}>🗑️</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {transactions.length === 0 && (
                        <div style={styles.empty}>No transactions found. Add your first transaction!</div>
                    )}
                </div>
            )}

            {/* Category Breakdown */}
            {summary && summary.byCategory.length > 0 && (
                <div style={styles.breakdownSection}>
                    <h3 style={styles.breakdownTitle}>📊 Spending by Category</h3>
                    <div style={styles.breakdownGrid}>
                        {summary.byCategory
                            .filter(item => item.type === 'expense')
                            .map((item, idx) => (
                                <div key={idx} style={styles.breakdownCard}>
                                    <div style={styles.breakdownCategory}>{item.category}</div>
                                    <div style={styles.breakdownTotal}>{formatCurrency(Number(item.total))}</div>
                                    <div style={styles.breakdownMeta}>
                                        {item.count} transactions · Avg: {formatCurrency(Number(item.average))}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
    },
    title: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#1f2937',
        margin: 0,
    },
    addButton: {
        padding: '12px 24px',
        backgroundColor: '#6366f1',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
    },
    summaryCard: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        borderLeft: '4px solid',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    summaryLabel: {
        fontSize: '14px',
        color: '#6b7280',
        marginBottom: '8px',
    },
    summaryValue: {
        fontSize: '28px',
        fontWeight: 700,
    },
    formCard: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    formTitle: {
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '16px',
        color: '#1f2937',
    },
    formGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '16px',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
    },
    label: {
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '6px',
        color: '#374151',
    },
    input: {
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
    },
    select: {
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: 'white',
    },
    saveButton: {
        padding: '12px 24px',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    filterBar: {
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
    },
    filterSelect: {
        padding: '10px 16px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        backgroundColor: 'white',
        minWidth: '150px',
    },
    error: {
        padding: '12px 16px',
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        borderRadius: '8px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dismissError: {
        background: 'none',
        border: 'none',
        color: '#991b1b',
        cursor: 'pointer',
        fontSize: '18px',
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#6b7280',
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    th: {
        textAlign: 'left',
        padding: '14px 16px',
        backgroundColor: '#f9fafb',
        fontWeight: 600,
        color: '#374151',
        borderBottom: '1px solid #e5e7eb',
    },
    tr: {
        borderBottom: '1px solid #e5e7eb',
    },
    td: {
        padding: '14px 16px',
        color: '#1f2937',
    },
    amount: {
        fontWeight: 600,
        fontFamily: 'monospace',
    },
    typeBadge: {
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
    },
    editBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        marginRight: '8px',
    },
    deleteBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
    },
    editInput: {
        padding: '6px 10px',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '13px',
        width: '100%',
    },
    editSelect: {
        padding: '6px 10px',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        fontSize: '13px',
        backgroundColor: 'white',
    },
    saveBtn: {
        padding: '6px 12px',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginRight: '6px',
    },
    cancelBtn: {
        padding: '6px 12px',
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    empty: {
        textAlign: 'center',
        padding: '40px',
        color: '#9ca3af',
    },
    breakdownSection: {
        marginTop: '32px',
    },
    breakdownTitle: {
        fontSize: '20px',
        fontWeight: 600,
        marginBottom: '16px',
        color: '#1f2937',
    },
    breakdownGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
    },
    breakdownCard: {
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    breakdownCategory: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '8px',
    },
    breakdownTotal: {
        fontSize: '24px',
        fontWeight: 700,
        color: '#ef4444',
        marginBottom: '4px',
    },
    breakdownMeta: {
        fontSize: '12px',
        color: '#9ca3af',
    },
};
