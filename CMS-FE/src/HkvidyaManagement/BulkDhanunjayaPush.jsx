import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '../api/api';

const BulkDhanunjayaPush = () => {
  const [paymentIds, setPaymentIds] = useState([]);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pushSummary, setPushSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        const extractedIds = [];
        data.forEach(row => {
          if (row.length > 0) {
            const cellVal = String(row[0]).trim();
            if (cellVal.startsWith('pay_')) {
              extractedIds.push(cellVal);
            }
          }
        });

        if (extractedIds.length === 0) {
          toast.error('No valid Razorpay Payment IDs (starting with "pay_") found in the first column.');
          setPaymentIds([]);
        } else {
          setPaymentIds(extractedIds);
          toast.success(`Successfully parsed ${extractedIds.length} Payment IDs.`);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleResolve = async () => {
    if (paymentIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl('api/hkvidya-subscriptions/bulk-resolve-payment-ids'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentIds })
      });
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
        toast.success(`Resolved ${data.summary.resolved} out of ${data.summary.total} payment IDs.`);
      } else {
        toast.error(data.message || 'Failed to resolve payment IDs.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during resolution.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    if (!results) return;
    
    const resolvedRows = results.filter(r => r.resolved);
    if (resolvedRows.length === 0) return;

    const subscriptionIds = resolvedRows.map(r => r.subscriptionId);
    
    setIsPushing(true);
    try {
      const response = await fetch(getApiUrl('api/hkvidya-subscriptions/bulk-push-dhanunjaya'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscriptionIds })
      });
      const data = await response.json();
      
      if (data.success) {
        const pushResultsMap = {};
        data.results.forEach(res => {
          pushResultsMap[res.subscriptionId] = res;
        });

        const updatedResults = results.map(row => {
          if (row.resolved && row.subscriptionId && pushResultsMap[row.subscriptionId]) {
            const pr = pushResultsMap[row.subscriptionId];
            return {
              ...row,
              pushStatus: pr.success ? 'success' : 'failed',
              pushMessage: pr.message
            };
          }
          return row;
        });

        setResults(updatedResults);
        setPushSummary(data.summary);
        toast.success(`${data.summary.pushed} pushed successfully, ${data.summary.failed} failed.`);
      } else {
        toast.error(data.message || 'Failed to push to Dhanunjaya.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during bulk push.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleStartOver = () => {
    setPaymentIds([]);
    setResults(null);
    setSummary(null);
    setPushSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resolvedCount = results ? results.filter(r => r.resolved).length : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Bulk Dhanunjaya Push</h2>
              <p className="text-blue-100 mt-2">
                Upload an Excel sheet of Razorpay Payment IDs to resolve and push their subscriptions to Dhanunjaya in bulk.
              </p>
            </div>
            {results && (
              <button 
                onClick={handleStartOver}
                className="bg-white text-blue-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* INSTRUCTIONS CARD */}
          {!results && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-1">Instructions</h3>
              <p className="text-sm text-blue-800">
                The Excel file should contain a single column of Razorpay Payment IDs (e.g. pay_XXXXXXXXXXXX), one per row. The first row can optionally be a header (e.g. 'Payment ID') — it will be automatically skipped if it doesn't match the pay_ prefix pattern.
              </p>
            </div>
          )}

          {/* UPLOAD SECTION */}
          {!results && (
            <div className="mb-6 flex flex-col items-start gap-4">
              <input 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100 cursor-pointer"
              />
              
              {paymentIds.length > 0 && (
                <div className="text-gray-700 font-medium">
                  {paymentIds.length} Payment IDs detected
                </div>
              )}

              <button
                onClick={handleResolve}
                disabled={paymentIds.length === 0 || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resolving...
                  </>
                ) : (
                  'Resolve Payment IDs'
                )}
              </button>
            </div>
          )}

          {/* RESOLVE STEP & PREVIEW TABLE */}
          {results && (
            <div className="mt-4">
              {summary && (
                <div className="mb-6 text-lg font-semibold text-gray-800">
                  Summary: {summary.resolved} resolved, {summary.failed} failed out of {summary.total}
                </div>
              )}

              {/* CONFIRM & PUSH BUTTON */}
              {resolvedCount > 0 && (
                <div className="mb-6">
                  <button
                    onClick={handlePush}
                    disabled={isPushing}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                  >
                    {isPushing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Pushing to Dhanunjaya...
                      </>
                    ) : (
                      `Confirm & Push All Resolved (${resolvedCount})`
                    )}
                  </button>
                </div>
              )}

              <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Payment ID</th>
                      <th className="px-4 py-3">Subscription ID</th>
                      <th className="px-4 py-3">Donor Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.paymentId}</td>
                        <td className="px-4 py-3 text-gray-600">{row.subscriptionId || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.resolved && row.subscriptionData ? row.subscriptionData.full_name : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {row.pushStatus === 'success' ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Pushed Successfully</span>
                          ) : row.pushStatus === 'failed' ? (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Push Failed</span>
                          ) : row.resolved ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Resolved</span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Failed to Resolve</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={row.pushMessage || row.reason || ''}>
                          {row.pushMessage ? (
                            <span>{row.pushMessage}</span>
                          ) : row.resolved && row.subscriptionData ? (
                            <span>₹{row.subscriptionData.amount} | {row.subscriptionData.payment_status}</span>
                          ) : (
                            <span className="text-red-600">{row.reason}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pushSummary && (
                <div className={`mt-6 p-4 rounded-lg border font-semibold text-lg ${
                  pushSummary.failed === 0 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  Push Complete: {pushSummary.pushed} pushed successfully, {pushSummary.failed} failed out of {pushSummary.total}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkDhanunjayaPush;
