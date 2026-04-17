
import { useState, useEffect } from "react";
import { adminAPI } from "../services/api";

import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";

import { AdminKpiGrid } from "../components/admin/AdminKpiCard";
import { FarmersTable } from "../components/admin/FarmerTable";
import { SystemStatusCard } from "../components/admin/SystemStatusCard";

import { Search } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoad] = useState(true);
  const [fLoad, setFL] = useState(false);

  const loadDash = async () => {
    try {
      setLoad(true);
      const r = await adminAPI.dashboard();
      setData(r?.data?.data || {});
    } catch {
      setData({});
    } finally {
      setLoad(false);
    }
  };

  const loadFarmers = async () => {
    try {
      setFL(true);
      const r = await adminAPI.farmers({ search, limit: 20 });
      setFarmers(r?.data?.data?.farmers || []);
      setTotal(r?.data?.data?.total || 0);
    } catch {
      setFarmers([]);
      setTotal(0);
    } finally {
      setFL(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadDash();
      await loadFarmers();
    };

    init();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFarmers();
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggle(id);
      toast.success("User status updated");
      loadFarmers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="font-display font-bold text-xl text-ink-800">Admin Panel</h2>

      <AdminKpiGrid data={data} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <SectionHeader title="Farmers" subtitle={`${total} registered`} />
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field text-sm pl-9 py-2"
                placeholder="Search farmers…"
              />
            </div>
          </div>
          <FarmersTable farmers={farmers} loading={fLoad} onToggle={handleToggle} />
        </Card>

        <Card className="p-5">
          <SectionHeader title="System Status" subtitle="All services operational" className="mb-4" />
          <SystemStatusCard />
        </Card>
      </div>
    </div>
  );
}