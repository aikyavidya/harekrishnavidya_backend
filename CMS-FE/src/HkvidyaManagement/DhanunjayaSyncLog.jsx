import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../api/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  FaHistory
} from 'react-icons/fa';

const DhanunjayaSyncLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  
  const [jumpToPage, setJumpToPage] = useState('');

  useEffect(() => {
    fetchLogs(pagination.page);
  }, [pagination.page]);

  const fetchLogs = async (page) => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/dhanunjaya-sync-log?page=${page}&limit=${pagination.limit}`));
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || 'Failed to fetch logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
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

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      dry_run: 'bg-yellow-100 text-yellow-800'
    };
    const colorClass = statusMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FaHistory className="text-blue-600" />
          Dhanunjaya Sync Log
        </h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p>Loading sync logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>No sync logs found yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Subscription ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Donor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response Message</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log, index) => (
                  <tr key={`${log.razorpay_subscription_id}-${index}`} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.razorpay_subscription_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.donor_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div 
                        className="truncate max-w-md"
                        title={log.responseMessage}
                      >
                        {log.responseMessage}
                      </div>
                    </td>
                  </tr>
                ))}
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

export default DhanunjayaSyncLog;
