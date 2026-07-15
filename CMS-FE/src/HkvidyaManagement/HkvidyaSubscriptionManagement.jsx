import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  FaHeart,
  FaSearch,
  FaDownload,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSync,
  FaUpload,
  FaSave,
  FaTimes
} from 'react-icons/fa';
import { FcOk } from "react-icons/fc";

const HkvidyaSubscriptionManagement = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  
  // Tracks unsaved edits per row (keyed by razorpay_subscription_id)
  const [editedRows, setEditedRows] = useState({});
  const [dryRunPayload, setDryRunPayload] = useState(null);
  const [jumpToPage, setJumpToPage] = useState('');

  useEffect(() => {
    fetchSubscriptions(pagination.page);
  }, [pagination.page]);

  const fetchSubscriptions = async (page) => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions?page=${page}&limit=${pagination.limit}`));
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.subscriptions);
        setPagination(data.pagination);
        setEditedRows({}); // Clear edits on page load
      } else {
        toast.error(data.error || 'Failed to fetch subscriptions');
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleJumpSubmit = (e) => {
    if (e) e.preventDefault();
    const pageNum = Number(jumpToPage);
    if (!pageNum || pageNum < 1 || pageNum > pagination.totalPages) {
      toast.error(`Enter a page between 1 and ${pagination.totalPages}`);
      return;
    }
    handlePageChange(pageNum);
    setJumpToPage('');
  };

  const handleEditChange = (subId, field, value) => {
    setEditedRows(prev => ({
      ...prev,
      [subId]: {
        ...(prev[subId] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveRow = async (subId) => {
    const changes = editedRows[subId];
    if (!changes) return;

    try {
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subId}/overlay`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Overlay updated successfully');
        // Update local state
        setSubscriptions(prev => prev.map(sub => {
          if (sub.razorpay_subscription_id === subId) {
            return { ...sub, overlay: { ...sub.overlay, ...changes } };
          }
          return sub;
        }));
        // Remove from edited rows
        const newEdited = { ...editedRows };
        delete newEdited[subId];
        setEditedRows(newEdited);
      } else {
        toast.error(data.error || 'Failed to update overlay');
      }
    } catch (error) {
      console.error('Error updating overlay:', error);
      toast.error('An error occurred while saving');
    }
  };

  const handleSyncWithRazorpay = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch(getApiUrl('api/hkvidya-subscriptions/sync-razorpay'), {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        const { totalChecked, missingCreated, mismatchedCorrected, alreadyCorrect } = data.metrics;
        toast.success(`Sync complete: ${mismatchedCorrected} corrected, ${missingCreated} created, ${alreadyCorrect} already correct (Total checked: ${totalChecked})`, { duration: 5000 });
        fetchSubscriptions(pagination.page); // Refresh current page
      } else {
        toast.error(data.error || 'Failed to sync with Razorpay');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('An error occurred during sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushDhanunjaya = async (subId) => {
    const sub = subscriptions.find(s => s.razorpay_subscription_id === subId);
    if (sub && sub.payment_status?.toLowerCase() !== 'active') return;

    try {
      toast.loading('Pushing to Dhanunjaya...', { id: 'push' });
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subId}/push-dhanunjaya`), {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        toast.dismiss('push');
        if (data.dryRun) {
          setDryRunPayload(data.payload);
        } else {
          toast.success('Pushed to Dhanunjaya successfully');
          fetchSubscriptions(pagination.page);
        }
      } else {
        toast.error(data.error || data.message || 'Failed to push to Dhanunjaya', { id: 'push' });
        fetchSubscriptions(pagination.page);
      }
    } catch (error) {
      console.error('Error pushing:', error);
      toast.error('An error occurred during push', { id: 'push' });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount); // Amount is already in rupees
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      halted: 'bg-red-100 text-red-800',
      expired: 'bg-red-100 text-red-800'
    };
    const colorClass = statusMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getDhanunjayaStatus = (overlay) => {
    if (overlay.dhanunjayaSynced) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Synced</span>;
    }
    if (overlay.dhanunjayaSyncFailed) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Synced</span>;
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FaHeart className="text-blue-600" />
          hkvidya Subscriptions
        </h1>
        <button
          onClick={handleSyncWithRazorpay}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
        >
          <FaSync className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync with Razorpay'}
        </button>
      </div>

      {/* Dry Run Modal */}
      {dryRunPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-yellow-50 p-4 border-b border-yellow-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2">
                  <FaExclamationTriangle />
                  DRY RUN — No data was actually sent
                </h3>
                <p className="text-sm text-yellow-700 mt-1">This is the payload that would be sent to Dhanunjaya.</p>
              </div>
              <button onClick={() => setDryRunPayload(null)} className="text-gray-500 hover:text-gray-800">
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm">
              <pre>{JSON.stringify(dryRunPayload, null, 2)}</pre>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setDryRunPayload(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p>Loading subscriptions...</p>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>No subscriptions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">80G</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PAN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dhanunjaya</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptions.map(sub => {
                  const subId = sub.razorpay_subscription_id;
                  const edits = editedRows[subId] || {};
                  const isEdited = Object.keys(edits).length > 0;
                  
                  // Use edited value if present, else overlay value, else default to sub value (for some fields) or empty
                  const current80G = edits.wants80G !== undefined ? edits.wants80G : (sub.overlay?.wants80G ?? sub.wants_80g ?? false);
                  const currentPan = edits.panNumber !== undefined ? edits.panNumber : (sub.overlay?.panNumber || sub.pan || '');
                  const currentAddress = edits.fullAddress !== undefined ? edits.fullAddress : (sub.overlay?.fullAddress || [sub.address_line_1, sub.address_line_2, sub.city, sub.state, sub.country, sub.pincode].filter(Boolean).join(', ') || '');
                  const currentEmployee = edits.assignedEmployee !== undefined ? edits.assignedEmployee : (sub.overlay?.assignedEmployee || '');

                  const isActive = sub.payment_status?.toLowerCase() === 'active';
                  const disabledTooltip = "Only active subscriptions can be edited or pushed to Dhanunjaya";

                  return (
                    <tr key={subId} className="hover:bg-gray-50 transition-colors duration-150">
                      {/* Donor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sub.full_name}</div>
                        <div className="text-xs text-gray-500">{sub.email}</div>
                        <div className="text-xs text-gray-500">{sub.phone}</div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(sub.amount)}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(sub.payment_status)}
                      </td>

                      {/* 80G */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={current80G}
                          onChange={(e) => handleEditChange(subId, 'wants80G', e.target.checked)}
                          disabled={!isActive}
                          title={!isActive ? disabledTooltip : undefined}
                          className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${!isActive ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </td>

                      {/* PAN */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={currentPan}
                          onChange={(e) => handleEditChange(subId, 'panNumber', e.target.value.toUpperCase())}
                          placeholder="PAN"
                          disabled={!isActive}
                          title={!isActive ? disabledTooltip : undefined}
                          className={`w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 ${!isActive ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </td>

                      {/* Address */}
                      <td className="px-4 py-3">
                        <textarea
                          value={currentAddress}
                          onChange={(e) => handleEditChange(subId, 'fullAddress', e.target.value)}
                          placeholder="Full Address"
                          rows={2}
                          disabled={!isActive}
                          title={!isActive ? disabledTooltip : undefined}
                          className={`w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 resize-none ${!isActive ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </td>

                      {/* Assigned Employee */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          value={currentEmployee}
                          onChange={(e) => handleEditChange(subId, 'assignedEmployee', e.target.value)}
                          placeholder="Employee"
                          disabled={!isActive}
                          title={!isActive ? disabledTooltip : undefined}
                          className={`w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 ${!isActive ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </td>

                      {/* Dhanunjaya Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getDhanunjayaStatus(sub.overlay)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        <div className="flex flex-col items-end gap-2">
                          {isEdited && isActive && (
                            <button
                              onClick={() => handleSaveRow(subId)}
                              className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs w-full justify-center"
                            >
                              <FaSave /> Save
                            </button>
                          )}
                          <button
                            onClick={() => handlePushDhanunjaya(subId)}
                            disabled={!isActive}
                            title={!isActive ? disabledTooltip : undefined}
                            className={`flex items-center gap-1 px-2 py-1 text-white rounded text-xs w-full justify-center ${!isActive ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                          >
                            <FaUpload /> Push to DJ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              
              <form onSubmit={handleJumpSubmit} className="flex gap-1 items-center mx-1">
                <input
                  type="number"
                  min="1"
                  max={pagination.totalPages}
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  className="w-14 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-center"
                />
                <button
                  type="submit"
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 bg-white"
                >
                  Go
                </button>
              </form>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HkvidyaSubscriptionManagement;
