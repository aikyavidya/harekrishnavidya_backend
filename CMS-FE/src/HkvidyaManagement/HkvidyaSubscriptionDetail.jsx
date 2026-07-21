import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiUrl } from '../api/api';
import { 
  FaHeart, 
  FaUser, 
  FaMapMarkerAlt,
  FaEnvelope, 
  FaPhone, 
  FaRupeeSign, 
  FaEdit, 
  FaArrowLeft,
  FaCalendarAlt,
  FaCreditCard,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaExclamationTriangle,
  FaFileAlt
} from 'react-icons/fa';

const HkvidyaSubscriptionDetail = () => {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState(false);
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [editingDonor, setEditingDonor] = useState(false);
  const [donorForm, setDonorForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    area_of_stay: ''
  });
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    wants80G: false,
    panNumber: '',
    fullAddress: ''
  });
  const [dryRunPayload, setDryRunPayload] = useState(null);

  useEffect(() => {
    fetchSubscription();
  }, [subscriptionId]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/view/${subscriptionId}`));
      const result = await response.json();

      if (result.success && result.subscription) {
        setData(result.subscription);
        setAssignedEmployee(result.subscription.overlay?.assignedEmployee || '');
        setDonorForm({
          full_name: result.subscription.full_name || '',
          email: result.subscription.email || '',
          phone: result.subscription.phone || '',
          area_of_stay: result.subscription.area_of_stay || ''
        });
        setAddressForm({
          wants80G: result.subscription.overlay?.wants80G ?? result.subscription.wants_80g ?? false,
          panNumber: result.subscription.overlay?.panNumber || result.subscription.pan || '',
          fullAddress: result.subscription.overlay?.fullAddress || [result.subscription.address_line_1, result.subscription.address_line_2, result.subscription.city, result.subscription.state, result.subscription.country, result.subscription.pincode].filter(Boolean).join(', ') || ''
        });
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    try {
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subscriptionId}/overlay`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedEmployee })
      });
      const result = await response.json();

      if (result.success) {
        setEditingEmployee(false);
        toast.success('Assigned employee updated successfully');
        fetchSubscription(); // Refresh data
      } else {
        toast.error(result.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('An error occurred while saving');
    }
  };

  const handleUpdateDonor = async () => {
    try {
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subscriptionId}/donor`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(donorForm)
      });
      const result = await response.json();

      if (result.success) {
        setEditingDonor(false);
        toast.success('Donor information updated successfully');
        fetchSubscription(); // Refresh data
      } else {
        toast.error(result.error || 'Failed to update donor information');
      }
    } catch (error) {
      console.error('Error updating donor info:', error);
      toast.error('An error occurred while saving');
    }
  };

  const handleUpdateAddress = async () => {
    try {
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subscriptionId}/overlay`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressForm)
      });
      const result = await response.json();

      if (result.success) {
        setEditingAddress(false);
        toast.success('Address and 80G information updated successfully');
        fetchSubscription(); // Refresh data
      } else {
        toast.error(result.error || 'Failed to update address information');
      }
    } catch (error) {
      console.error('Error updating address info:', error);
      toast.error('An error occurred while saving');
    }
  };

  const handlePushDhanunjaya = async () => {
    try {
      toast.loading('Pushing to Dhanunjaya...', { id: 'push' });
      const response = await fetch(getApiUrl(`api/hkvidya-subscriptions/${subscriptionId}/push-dhanunjaya`), {
        method: 'POST'
      });
      const result = await response.json();

      if (result.success) {
        toast.dismiss('push');
        if (result.dryRun) {
          setDryRunPayload(result.payload);
        } else {
          toast.success('Pushed to Dhanunjaya successfully');
          fetchSubscription();
        }
      } else {
        toast.error(result.error || result.message || 'Failed to push to Dhanunjaya', { id: 'push' });
        fetchSubscription();
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
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'completed':
        return <FaCheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <FaClock className="w-5 h-5 text-yellow-600" />;
      case 'cancelled':
      case 'halted':
      case 'expired':
        return <FaTimesCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FaExclamationTriangle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
      case 'halted':
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDhanunjayaBadge = (overlay) => {
    if (overlay?.dhanunjayaSynced) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Synced</span>;
    }
    if (overlay?.dhanunjayaSyncFailed) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Synced</span>;
  };

  const getSyncLogStatusBadge = (status) => {
    switch(status) {
      case 'success':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Success</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Failed</span>;
      case 'dry_run':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Dry Run</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="h-96 bg-gray-300 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="text-center py-12">
          <FaHeart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Subscription not found</h3>
          <p className="text-gray-600">The subscription you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const { overlay } = data;
  const showAddressCard = overlay?.wants80G || overlay?.panNumber || overlay?.fullAddress || data.address_line_1 || data.address_line_2 || data.city || data.state || data.country || data.pincode;
  const addressToDisplay = overlay?.fullAddress || [data.address_line_1, data.address_line_2, data.city, data.state, data.country, data.pincode].filter(Boolean).join(', ');
  const panToDisplay = overlay?.panNumber || data.pan;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/hkvidya-subscriptions')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Subscriptions
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <FaHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Subscription Details</h1>
              <p className="text-gray-600">ID: {data.razorpay_subscription_id}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Subscription Status Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Subscription Status</h2>
                {getStatusIcon(data.payment_status)}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(data.payment_status)}`}>
                  {(data.payment_status || 'UNKNOWN').toUpperCase()}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.amount)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-100">
                <div>
                  <p className="text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">{data.created_at ? formatDate(data.created_at) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Next Billing Date</p>
                  <p className="font-medium text-gray-900">{data.razorpayLiveData?.nextChargeAt ? formatDate(data.razorpayLiveData.nextChargeAt) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Plan Type</p>
                  <p className="font-medium text-gray-900 capitalize">{data.plan_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Billing Frequency</p>
                  <p className="font-medium text-gray-900">{(() => {
                    const period = data.razorpayLiveData?.planPeriod;
                    const interval = data.razorpayLiveData?.planInterval;
                    if (!period) return 'N/A';
                    if (!interval || interval === 1) {
                      if (period === 'daily') return 'Daily';
                      if (period === 'weekly') return 'Weekly';
                      if (period === 'monthly') return 'Monthly';
                      if (period === 'yearly') return 'Yearly';
                      return period.charAt(0).toUpperCase() + period.slice(1);
                    }
                    const pluralMap = {
                      'daily': 'days',
                      'weekly': 'weeks',
                      'monthly': 'months',
                      'yearly': 'years'
                    };
                    const noun = pluralMap[period] || `${period}s`;
                    return `Every ${interval} ${noun}`;
                  })()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Payment Mode</p>
                  <p className="font-medium text-gray-900 capitalize">{data.payment_mode || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Payment Method</p>
                  <p className="font-medium text-gray-900">{data.razorpayLiveData?.paymentMethod ? data.razorpayLiveData.paymentMethod.toUpperCase() : 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Billing Progress</p>
                  <p className="font-medium text-gray-900">
                    {data.razorpayLiveData?.paidCount != null && data.razorpayLiveData?.totalCount != null
                      ? `${data.razorpayLiveData.paidCount} of ${data.razorpayLiveData.totalCount} cycles completed`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Donor Information */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FaUser className="w-5 h-5 text-blue-600" />
                  Donor Information
                </h2>
                <button
                  onClick={() => {
                    if (editingDonor) {
                      setDonorForm({
                        full_name: data.full_name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        area_of_stay: data.area_of_stay || ''
                      });
                    }
                    setEditingDonor(!editingDonor);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {editingDonor ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {editingDonor ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={donorForm.full_name}
                        onChange={(e) => setDonorForm({ ...donorForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={donorForm.email}
                        onChange={(e) => setDonorForm({ ...donorForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={donorForm.phone}
                        onChange={(e) => setDonorForm({ ...donorForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Area of Stay</label>
                      <input
                        type="text"
                        value={donorForm.area_of_stay}
                        onChange={(e) => setDonorForm({ ...donorForm, area_of_stay: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleUpdateDonor}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Full Name</p>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <FaUser className="w-4 h-4 text-gray-400" />
                      {data.full_name || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Email Address</p>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <FaEnvelope className="w-4 h-4 text-gray-400" />
                      {data.email || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Phone Number</p>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <FaPhone className="w-4 h-4 text-gray-400" />
                      {data.phone || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Area of Stay</p>
                    <p className="font-medium text-gray-900">
                      {data.area_of_stay || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-1">Razorpay Customer ID</p>
                    <p className="font-medium text-gray-900">
                      {data.razorpayLiveData?.customerId || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 80G & Address Details */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FaMapMarkerAlt className="w-5 h-5 text-orange-500" />
                  80G & Address Details
                </h2>
                <button
                  onClick={() => {
                    if (editingAddress) {
                      setAddressForm({
                        wants80G: overlay?.wants80G ?? data.wants_80g ?? false,
                        panNumber: panToDisplay || '',
                        fullAddress: addressToDisplay || ''
                      });
                    }
                    setEditingAddress(!editingAddress);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {editingAddress ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editingAddress ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addressForm.wants80G}
                          onChange={(e) => setAddressForm({ ...addressForm, wants80G: e.target.checked })}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-900">Requires 80G Tax Exemption</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">PAN Number</label>
                      <input
                        type="text"
                        value={addressForm.panNumber}
                        onChange={(e) => setAddressForm({ ...addressForm, panNumber: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        placeholder="ABCDE1234F"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Full Address</label>
                      <textarea
                        value={addressForm.fullAddress}
                        onChange={(e) => setAddressForm({ ...addressForm, fullAddress: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                        rows="3"
                        placeholder="Enter complete address..."
                      ></textarea>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleUpdateAddress}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">80G Tax Exemption</p>
                    {overlay?.wants80G ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Yes</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">No</span>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PAN Number</p>
                    <p className="font-mono font-medium text-gray-900">{panToDisplay || 'N/A'}</p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Full Address</p>
                    <p className="font-medium text-gray-900">
                      {addressToDisplay || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FaCreditCard className="w-5 h-5 text-green-600" />
                Payment History
              </h2>
              
              {data.recurring_payments && data.recurring_payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charged Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...data.recurring_payments]
                        .sort((a, b) => new Date(b.charged_at) - new Date(a.charged_at))
                        .map((payment, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">{payment.payment_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(payment.charged_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">No recurring payments recorded yet.</p>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Employee Assignment */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FaUser className="w-5 h-5 text-purple-600" />
                  Employee Assignment
                </h3>
                <button
                  onClick={() => setEditingEmployee(!editingEmployee)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {editingEmployee ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {editingEmployee ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={assignedEmployee}
                    onChange={(e) => setAssignedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter assigned employee..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateEmployee}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmployee(false);
                        setAssignedEmployee(overlay?.assignedEmployee || '');
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {overlay?.assignedEmployee ? (
                    <p className="text-gray-900 font-medium">{overlay.assignedEmployee}</p>
                  ) : (
                    <p className="text-gray-500 italic">No employee assigned yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Dhanunjaya Sync Status */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dhanunjaya Sync</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-sm">Status:</span>
                  {getDhanunjayaBadge(overlay)}
                </div>
                
                {overlay?.lastSyncedAt && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-600 text-sm">Last Synced:</span>
                    <span className="text-gray-900 text-sm font-medium">{formatDate(overlay.lastSyncedAt)}</span>
                  </div>
                )}

                <button
                  onClick={handlePushDhanunjaya}
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Push to Dhanunjaya
                </button>
                
                {dryRunPayload && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Dry Run Payload:</p>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto border border-gray-200">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(dryRunPayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sync Log History */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FaFileAlt className="w-5 h-5 text-gray-600" />
                Sync Log History
              </h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {overlay?.syncLog && overlay.syncLog.length > 0 ? (
                  [...overlay.syncLog]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((log, idx) => (
                    <div key={idx} className="border-l-2 border-gray-200 pl-3 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getSyncLogStatusBadge(log.status)}
                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 break-words">{log.responseMessage}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm italic">No sync logs available.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default HkvidyaSubscriptionDetail;
