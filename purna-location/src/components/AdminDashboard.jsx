import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    email: true,
    message: true,
    submittedAt: true,
    ipAddress: true,
    location: true,
    deviceInfo: true,
    screenResolution: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'submittedAt', direction: 'desc' });
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    // Calculate statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = {
      total: submissions.length,
      today: submissions.filter(s => new Date(s.submittedAt) >= today).length,
      thisWeek: submissions.filter(s => new Date(s.submittedAt) >= weekAgo).length,
      thisMonth: submissions.filter(s => new Date(s.submittedAt) >= monthAgo).length
    };

    setStats(stats);
  }, [submissions]);

  const getLocationString = (location) => {
    if (!location) return 'N/A';
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.region) parts.push(location.region);
    if (location.country) parts.push(location.country);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  };

  const getCoordinates = (location) => {
    if (location?.latitude && location?.longitude) {
      return `${location.latitude}, ${location.longitude}`;
    }
    return null;
  };

  const getGoogleMapsUrl = (location) => {
    const coords = getCoordinates(location);
    if (coords) {
      return `https://www.google.com/maps?q=${coords}`;
    }
    return null;
  };

  const fetchSubmissions = async () => {
    try {
      const q = query(collection(db, 'contacts'), orderBy('submittedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const submissionsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let submittedAt;
        
        // Handle different date formats
        if (data.submittedAt) {
          if (typeof data.submittedAt.toDate === 'function') {
            submittedAt = data.submittedAt.toDate();
          } else if (data.submittedAt instanceof Date) {
            submittedAt = data.submittedAt;
          } else if (typeof data.submittedAt === 'string') {
            submittedAt = new Date(data.submittedAt);
          } else if (typeof data.submittedAt === 'number') {
            submittedAt = new Date(data.submittedAt);
          }
        }
        
        if (!submittedAt || isNaN(submittedAt.getTime())) {
          submittedAt = new Date();
        }

        const location = data.visitorData?.location;
        const coords = getCoordinates(location);
        const locationString = getLocationString(location);

        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          message: data.message || '',
          submittedAt: submittedAt,
          ipAddress: data.visitorData?.ip || '',
          location: locationString,
          coordinates: coords,
          googleMapsUrl: getGoogleMapsUrl(location),
          deviceInfo: data.visitorData?.deviceDetails?.platform || '',
          screenResolution: data.visitorData?.deviceDetails?.screenResolution || ''
        };
      });
      setSubmissions(submissionsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Error fetching submissions: ' + err.message);
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the selected items?')) return;
    
    try {
      await Promise.all(selectedItems.map(id => deleteDoc(doc(db, 'contacts', id))));
      setSubmissions(submissions.filter(s => !selectedItems.includes(s.id)));
      setSelectedItems([]);
    } catch (err) {
      setError('Error deleting submissions: ' + err.message);
    }
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const filteredData = submissions
        .filter(submission => 
          Object.entries(visibleColumns)
            .some(([key, visible]) => visible && submission[key]?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        );

      const csvContent = [
        // Headers
        Object.entries(visibleColumns)
          .filter(([_, visible]) => visible)
          .map(([key]) => key)
          .join(','),
        // Data rows
        ...filteredData.map(submission =>
          Object.entries(visibleColumns)
            .filter(([_, visible]) => visible)
            .map(([key]) => {
              const value = submission[key];
              return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            })
            .join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `submissions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      setError('Error exporting data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredSubmissions.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredSubmissions.map(s => s.id));
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const filteredSubmissions = submissions
    .filter(submission =>
      Object.entries(visibleColumns)
        .some(([key, visible]) => visible && submission[key]?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
      const aValue = a[sortConfig.key].toString().toLowerCase();
      const bValue = b[sortConfig.key].toString().toLowerCase();
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/4"></div>
            <div className="h-64 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4">
            <p className="text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-6">Admin Dashboard</h1>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Submissions', value: stats.total, color: 'from-blue-500/20 to-blue-600/20' },
              { label: 'Today', value: stats.today, color: 'from-green-500/20 to-green-600/20' },
              { label: 'This Week', value: stats.thisWeek, color: 'from-purple-500/20 to-purple-600/20' },
              { label: 'This Month', value: stats.thisMonth, color: 'from-pink-500/20 to-pink-600/20' }
            ].map((stat, index) => (
              <div key={index} className={`bg-gradient-to-br ${stat.color} backdrop-blur-sm rounded-xl p-4 border border-white/10`}>
                <p className="text-white/60 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              />
              <svg className="w-5 h-5 text-white/50 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/30 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </button>
              
              <div className="relative group">
                <button className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/30">
                  Columns
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                  {Object.entries(visibleColumns).map(([key, visible]) => (
                    <label key={key} className="flex items-center px-4 py-2 text-white hover:bg-white/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleColumn(key)}
                        className="mr-2"
                      />
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredSubmissions.length}
                      onChange={handleSelectAll}
                      className="rounded border-white/20"
                    />
                  </th>
                  {Object.entries(visibleColumns).map(([key, visible]) => visible && (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-6 py-4 text-left text-white/80 font-medium cursor-pointer hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                        {sortConfig.key === key && (
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              sortConfig.direction === 'desc' ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(submission.id)}
                        onChange={() => handleSelectItem(submission.id)}
                        className="rounded border-white/20"
                      />
                    </td>
                    {Object.entries(visibleColumns).map(([key, visible]) => visible && (
                      <td key={key} className="px-6 py-4 text-white/80">
                        {key === 'submittedAt' ? (
                          new Date(submission[key]).toLocaleString()
                        ) : key === 'location' ? (
                          <div className="flex flex-col gap-1">
                            <span>{submission[key]}</span>
                            {submission.coordinates && (
                              <div className="flex items-center gap-2 text-sm">
                                {/* <span className="text-white/60">{submission.coordinates}</span> */}
                                {submission.googleMapsUrl && (
                                  <a
                                    href={submission.googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Show on Map
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          submission[key]
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-white/60">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} of {filteredSubmissions.length} entries
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/30 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/30 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-white/20 shadow-xl">
            <div className="flex items-center gap-4">
              <span className="text-white">{selectedItems.length} items selected</span>
              <button
                onClick={handleBulkDelete}
                className="bg-red-500/20 hover:bg-red-500/30 text-white px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border border-red-500/20 hover:border-red-500/30"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 