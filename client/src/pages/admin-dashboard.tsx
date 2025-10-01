import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Play
} from "lucide-react";
import ToothIcon from "@/components/tooth-icon";

type Order = {
  id: number;
  orderNumber: string;
  patientName: string;
  patientId: string | null;
  selectedTeeth: Array<{ number: string; name: string; id: string }>;
  toothConfigurations: Record<string, any>;
  observations: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "Em Andamento", icon: Play, color: "bg-blue-100 text-blue-800" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-100 text-red-800" },
};

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      
      const response = await fetch(`/api/dental-orders?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
  });


  const orders = ordersData?.orders || [];
  const stats = {
    total: orders.length,
    pending: orders.filter((o: Order) => o.status === "pending").length,
    inProgress: orders.filter((o: Order) => o.status === "in_progress").length,
    completed: orders.filter((o: Order) => o.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <img src="/header-logo.png" alt="Logo" className="w-6 h-6" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Painel Administrativo</h1>
                <p className="text-xs text-gray-600">Laboratório Odontológico</p>
              </div>
            </div>
            <Link href="/">
              <Button
                variant="ghost"
                className="text-gray-600 hover:text-burgundy-600"
              >
                <FileText size={16} className="mr-2" />
                Novo Pedido
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Em Andamento</p>
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Concluídos</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                  <Input
                    placeholder="Buscar por número, paciente ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 focus:ring-burgundy-500 focus:border-burgundy-500"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="focus:ring-burgundy-500">
                    <Filter size={16} className="mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Odontológicos</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Carregando pedidos...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order: Order) => {
                  const StatusIcon = statusConfig[order.status].icon;
                  return (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-burgundy-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{order.orderNumber}</h3>
                            <Badge className={statusConfig[order.status].color}>
                              <StatusIcon size={12} className="mr-1" />
                              {statusConfig[order.status].label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Paciente: <span className="font-medium">{order.patientName}</span>
                            {order.patientId && ` (ID: ${order.patientId})`}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            Dentes: {order.selectedTeeth.map(t => t.number).join(", ")}
                          </p>
                          <p className="text-xs text-gray-500">
                            Criado em: {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="outline" size="sm" className="border-burgundy-500 text-burgundy-600 hover:bg-burgundy-50">
                            Ver Detalhes
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
