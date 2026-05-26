import { useEffect, useState } from 'react';
import { PageTransition, PremiumCard, Button } from '../components/ui';
import Layout from '../layouts/Layout';
import { adminAPI } from '../services/api';

const statusTone = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  reviewing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  dismissed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
};

export default function Admin() {
  const [overview, setOverview] = useState({ users: 0, listings: 0, reportsOpen: 0, reportsTotal: 0 });
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [ov, rep, usr, lst] = await Promise.all([
        adminAPI.overview(),
        adminAPI.reports(),
        adminAPI.users(),
        adminAPI.listings()
      ]);

      setOverview(ov.data.data || overview);
      setReports(rep.data.data || []);
      setUsers(usr.data.data || []);
      setListings(lst.data.data || []);
    } catch (error) {
      setMessage(error.userMessage || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateReport = async (id, status) => {
    await adminAPI.updateReportStatus(id, { status, actionTaken: status === 'dismissed' ? 'dismissed' : 'none' });
    load();
  };

  const takeReportAction = async (id, action) => {
    await adminAPI.takeReportAction(id, { action });
    load();
  };

  const toggleUserBlock = async (id, isBlocked) => {
    await adminAPI.setUserBlocked(id, isBlocked);
    load();
  };

  const toggleListingHide = async (id, isHidden) => {
    await adminAPI.setListingHidden(id, isHidden);
    load();
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container space-y-7">
            <div>
              <p className="chip mb-3">Admin controls</p>
              <h1 className="text-section-title">Moderation Command Center</h1>
              <p className="text-body-sm mt-2">Review reports, block abusive users, and hide unsafe listings.</p>
            </div>

            {message && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</p>}

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                ['Users', overview.users],
                ['Listings', overview.listings],
                ['Open Reports', overview.reportsOpen],
                ['Total Reports', overview.reportsTotal]
              ].map(([label, val]) => (
                <PremiumCard key={label} className="p-5">
                  <p className="text-body-sm">{label}</p>
                  <p className="text-3xl font-extrabold mt-2">{val}</p>
                </PremiumCard>
              ))}
            </div>

            <PremiumCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-feature-title">Reports Queue</h2>
                <p className="text-xs text-slate-500">{reports.length} reports</p>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-200/25">
                        <th className="py-3 pr-3">Type</th>
                        <th className="py-3 pr-3">Reason</th>
                        <th className="py-3 pr-3">Reported</th>
                        <th className="py-3 pr-3">Reporter</th>
                        <th className="py-3 pr-3">Status</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.slice(0, 50).map((report) => (
                        <tr key={report._id} className="border-b border-slate-200/10 align-top">
                          <td className="py-3 pr-3 font-medium">{report.targetType}</td>
                          <td className="py-3 pr-3">
                            <p>{report.reason}</p>
                            {report.explanation && <p className="mt-1 max-w-xs text-xs text-slate-500">{report.explanation}</p>}
                          </td>
                          <td className="py-3 pr-3">{report.targetUser?.name || report.targetId}</td>
                          <td className="py-3 pr-3">{report.reporter?.name || 'Unknown'}</td>
                          <td className="py-3 pr-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusTone[report.status] || statusTone.open}`}>
                              {report.status}
                            </span>
                            <p className="mt-1 text-xs text-slate-500">{report.actionTaken || 'none'}</p>
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => updateReport(report._id, 'reviewing')}>Review</Button>
                              {report.targetUser?._id && <Button size="sm" variant="danger" onClick={() => takeReportAction(report._id, 'block_user')}>Block User</Button>}
                              {report.targetType === 'listing' && <Button size="sm" variant="danger" onClick={() => takeReportAction(report._id, 'hide_listing')}>Hide Listing</Button>}
                              <Button size="sm" variant="gradient" onClick={() => takeReportAction(report._id, 'warning')}>Warn</Button>
                              <Button size="sm" variant="secondary" onClick={() => takeReportAction(report._id, 'dismiss')}>Dismiss</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PremiumCard>

            <div className="grid xl:grid-cols-2 gap-5">
              <PremiumCard className="p-5">
                <h2 className="text-feature-title mb-3">User Management</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {users.map((user) => (
                    <div key={user._id} className="premium-surface p-3 flex justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email} - {user.role}</p>
                      </div>
                      <Button size="sm" variant={user.isBlocked ? 'gradient' : 'danger'} onClick={() => toggleUserBlock(user._id, !user.isBlocked)}>
                        {user.isBlocked ? 'Unblock' : 'Block'}
                      </Button>
                    </div>
                  ))}
                </div>
              </PremiumCard>

              <PremiumCard className="p-5">
                <h2 className="text-feature-title mb-3">Listing Moderation</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {listings.map((listing) => (
                    <div key={listing._id} className="premium-surface p-3 flex justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold">{listing.title}</p>
                        <p className="text-xs text-slate-500">by {listing.user?.name || 'Unknown'} - {listing.isHidden ? 'Hidden' : 'Visible'}</p>
                      </div>
                      <Button size="sm" variant={listing.isHidden ? 'gradient' : 'danger'} onClick={() => toggleListingHide(listing._id, !listing.isHidden)}>
                        {listing.isHidden ? 'Unhide' : 'Hide'}
                      </Button>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
