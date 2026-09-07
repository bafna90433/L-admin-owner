import { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  Receipt, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { getCategoryTheme } from '../utils/categoryTheme';
import '../styles/Tasks.css';

interface CategoryItem {
  id?: string;
  name: string;
  createdAt?: string | Date;
  createdBy?: string;
}

interface CashTx {
  _id: string;
  txType: 'received' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
}

interface CategoriesProps {
  token: string | null;
  apiBase: string;
  transactions?: CashTx[];
  onNavigate?: (tab: any) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  setConfirmModal?: (modal: { title: string; message: string; onConfirm: () => void } | null) => void;
}


export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Company Expenses',
  'Petrol / Vehicle Fuel',
  'Transport / Porter',
  'Staff Welfare & Tea Snacks',
  'Labour Advance',
  'Stationery & Office Supplies',
  'Maintenance & Repairs',
  'Electricity & Utility Bills',
  'General Petty Cash'
];

export default function Categories({
  token,
  apiBase,
  onNavigate,
  showToast,
  setConfirmModal
}: CategoriesProps) {
  const getInitialCategories = (): CategoryItem[] => {
    try {
      const saved = localStorage.getItem('office_categories_list');
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(name => ({ id: name, name, createdAt: new Date() }));
        }
      }
    } catch (e) {}
    return DEFAULT_EXPENSE_CATEGORIES.map(name => ({ id: name, name, createdAt: new Date() }));
  };

  const [categories, setCategories] = useState<CategoryItem[]>(getInitialCategories);
  const [loading, setLoading] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch categories from Backend API
  const fetchCategories = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        let formatted: CategoryItem[] = (Array.isArray(data) ? data : []).map(item => {
          if (typeof item === 'string') {
            return { id: item, name: item, createdAt: new Date() };
          }
          return item;
        });

        // If backend returned empty array, auto-seed defaults and save
        if (formatted.length === 0) {
          formatted = DEFAULT_EXPENSE_CATEGORIES.map(name => ({ id: name, name, createdAt: new Date() }));
          for (const name of DEFAULT_EXPENSE_CATEGORIES) {
            try {
              await fetch(`${apiBase}/categories`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
              });
            } catch (e) {}
          }
        }

        setCategories(formatted);

        // Keep local cache in sync
        try {
          const names = formatted.map(c => c.name);
          localStorage.setItem('office_categories_list', JSON.stringify(names));
          localStorage.removeItem('office_custom_categories');
        } catch (e) {}
      } else {
        loadFromLocal();
      }
    } catch (err) {
      console.error(err);
      loadFromLocal();
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocal = () => {
    try {
      const saved = localStorage.getItem('office_categories_list');
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed.map(name => ({ id: name, name, createdAt: new Date() })));
          return;
        }
      }
    } catch (e) {}
    setCategories(DEFAULT_EXPENSE_CATEGORIES.map(name => ({ id: name, name, createdAt: new Date() })));
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  // Handle Add New Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryInput.trim();
    if (!trimmed) {
      showToast('Please enter a category name', 'warning');
      return;
    }

    // Check if duplicate
    const isDuplicate = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      showToast(`Category "${trimmed}" already exists in the list`, 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: trimmed })
      });

      if (res.ok) {
        showToast(`✅ Category "${trimmed}" created successfully!`, 'success');
        setCategoryInput('');
        fetchCategories();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Failed to create category', 'danger');
      }
    } catch (err) {
      console.error(err);
      const newCatItem: CategoryItem = {
        id: Date.now().toString(),
        name: trimmed,
        createdAt: new Date(),
        createdBy: 'Admin'
      };
      const updated = [...categories, newCatItem];
      setCategories(updated);
      try {
        localStorage.setItem('office_categories_list', JSON.stringify(updated.map(c => c.name)));
      } catch (e) {}
      setCategoryInput('');
      showToast(`Category "${trimmed}" created locally`, 'success');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (categoryName: string) => {
    const performDelete = async () => {
      try {
        const res = await fetch(`${apiBase}/categories/${encodeURIComponent(categoryName)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          showToast(`Category "${categoryName}" deleted successfully`, 'success');
          fetchCategories();
        } else {
          const errorData = await res.json();
          showToast(errorData.message || 'Failed to delete category', 'danger');
        }
      } catch (err) {
        console.error(err);
        const filtered = categories.filter(c => c.name !== categoryName);
        setCategories(filtered);
        try {
          localStorage.setItem('office_categories_list', JSON.stringify(filtered.map(c => c.name)));
        } catch (e) {}
        showToast(`Category "${categoryName}" deleted locally`, 'info');
      }
    };

    if (setConfirmModal) {
      setConfirmModal({
        title: 'Delete Category',
        message: `Are you sure you want to delete "${categoryName}"? This category will be removed from the dropdown list.`,
        onConfirm: performDelete
      });
    } else if (window.confirm(`Delete category "${categoryName}"?`)) {
      performDelete();
    }
  };

  // Handle Clear / Delete All Categories
  const handleClearAllCategories = async () => {
    const performClearAll = async () => {
      try {
        const res = await fetch(`${apiBase}/categories/reset-all`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          setCategories([]);
          try {
            localStorage.setItem('office_categories_list', JSON.stringify([]));
            localStorage.removeItem('office_custom_categories');
          } catch (e) {}
          showToast('All categories cleared successfully!', 'success');
        } else {
          for (const cat of categories) {
            await fetch(`${apiBase}/categories/${encodeURIComponent(cat.name)}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => {});
          }
          setCategories([]);
          try {
            localStorage.setItem('office_categories_list', JSON.stringify([]));
            localStorage.removeItem('office_custom_categories');
          } catch (e) {}
          showToast('All categories cleared!', 'success');
        }
      } catch (err) {
        console.error(err);
        setCategories([]);
        try {
          localStorage.setItem('office_categories_list', JSON.stringify([]));
          localStorage.removeItem('office_custom_categories');
        } catch (e) {}
        showToast('All categories cleared locally', 'info');
      }
    };

    if (setConfirmModal) {
      setConfirmModal({
        title: 'Delete All Categories',
        message: 'Are you sure you want to delete ALL categories? You can add fresh ones anytime.',
        onConfirm: performClearAll
      });
    } else if (window.confirm('Are you sure you want to delete ALL categories?')) {
      performClearAll();
    }
  };

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  return (
    <div className="tasks-container animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* Title Section */}
      <div className="tasks-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag size={28} /> Expense Categories
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Create and manage categories. All added categories immediately appear in the expense dropdown across the app.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllCategories}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="Delete all categories and start fresh"
            >
              <Trash2 size={15} /> Delete All
            </button>
          )}

          <button
            type="button"
            onClick={fetchCategories}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} /> Refresh
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
            >
              <Receipt size={16} /> View Transactions <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Add Category Form + Categories Directory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Create Category Card */}
        <div className="glass-panel" style={{ padding: '28px', position: 'sticky', top: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <Sparkles size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Add New Category</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Category will be saved and immediately available in the dropdown when logging daily cash expenses.
          </p>

          <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                Category Name *
              </label>
              <input 
                type="text"
                className="form-input"
                placeholder="e.g. Flipkart, Amazon, Office Stationery, Tea & Snacks"
                value={categoryInput}
                onChange={e => setCategoryInput(e.target.value)}
                autoFocus
                required
                style={{ width: '100%', fontSize: '0.95rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !categoryInput.trim()}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} /> {isSubmitting ? 'Creating Category...' : 'Create Category'}
            </button>
          </form>

          {/* Quick Info Box */}
          <div style={{ marginTop: '24px', padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} color="#10b981" /> Seamless Integration
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Every category you create here seamlessly shows up in:
              <br />• <strong>Record Petty Cash Expense</strong> dropdown
              <br />• <strong>Transaction History</strong> filters
              <br />• <strong>Dashboard Category Breakdown</strong> charts
            </p>
          </div>
        </div>

        {/* Right Side: Categories Directory */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="#818cf8" /> Categories Directory
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  {categories.length} Total
                </span>
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                All expense categories active in dropdowns across the application.
              </p>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                className="form-input"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1.5px dashed rgba(255, 255, 255, 0.1)' }}>
              <Tag size={36} color="var(--text-secondary)" style={{ opacity: 0.5, marginBottom: '12px' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700 }}>No Categories Added Yet</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Start fresh! Use the form on the left to create your expense categories.
              </p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
              No categories match "{searchQuery}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
              {filteredCategories.map((cat, idx) => {
                const theme = getCategoryTheme(cat.name, idx);
                const IconComponent = theme.Icon;
                return (
                  <div 
                    key={cat.id || cat.name}
                    className="glass-panel animate-fade-in"
                    style={{
                      padding: '14px 18px',
                      borderRadius: '14px',
                      background: theme.bg,
                      border: `1.5px solid ${theme.border}`,
                      boxShadow: `0 4px 14px ${theme.glow}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: theme.iconGradient,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 4px 10px ${theme.glow}`
                      }}>
                        <IconComponent size={18} />
                      </div>
                      <span style={{ 
                        fontSize: '0.98rem', 
                        fontWeight: 750, 
                        color: 'var(--text-primary)', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em'
                      }}>
                        {cat.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.name)}
                      className="btn-action-delete"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'transform 0.15s ease'
                      }}
                      title="Delete Category"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
