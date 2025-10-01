import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play,
  User,
  ClipboardList,
  FileText,
  Calendar
} from "lucide-react";
import ToothIcon from "@/components/tooth-icon";
import jsPDF from "jspdf";

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

export default function AdminOrderDetail() {
  const params = useParams();
  const orderId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Fetch order details
  const { data: orderData, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const response = await fetch(`/api/dental-orders/${orderId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch order");
      }
      return response.json();
    },
  });

  const order: Order | undefined = orderData?.order;

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await fetch(`/api/dental-orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({
        title: "Status atualizado",
        description: "O status do pedido foi atualizado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar o status",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = () => {
    if (selectedStatus && selectedStatus !== order?.status) {
      updateStatusMutation.mutate(selectedStatus);
    }
  };

  const exportToPDF = () => {
    if (!order) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PEDIDO ODONTOLÓGICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Order Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Número do Pedido: ${order.orderNumber}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Status: ${statusConfig[order.status].label}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Data: ${new Date(order.createdAt).toLocaleString("pt-BR")}`, 20, yPosition);
    yPosition += 15;

    // Patient Info
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES DO PACIENTE", 20, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${order.patientName}`, 20, yPosition);
    yPosition += 7;
    if (order.patientId) {
      doc.text(`ID: ${order.patientId}`, 20, yPosition);
      yPosition += 7;
    }
    yPosition += 10;

    // Teeth
    doc.setFont("helvetica", "bold");
    doc.text("DENTES SELECIONADOS", 20, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "normal");
    const teethNumbers = order.selectedTeeth.map(t => t.number).join(", ");
    doc.text(`Dentes: ${teethNumbers}`, 20, yPosition);
    yPosition += 15;

    // Configurations
    doc.setFont("helvetica", "bold");
    doc.text("CONFIGURAÇÕES DOS DENTES", 20, yPosition);
    yPosition += 10;

    order.selectedTeeth.forEach((tooth) => {
      const config = order.toothConfigurations[tooth.id] || {};
      
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Dente ${tooth.number} (${tooth.name})`, 20, yPosition);
      yPosition += 6;
      doc.setFont("helvetica", "normal");
      
      if (config.workType) {
        doc.text(`• Tipo: ${config.workType === 'com_prova' ? 'Com prova' : 'Sem prova'}`, 25, yPosition);
        yPosition += 5;
      }
      if (config.material) {
        doc.text(`• Material: ${config.material}`, 25, yPosition);
        yPosition += 5;
      }
      if (config.color) {
        doc.text(`• Cor: ${config.color}`, 25, yPosition);
        yPosition += 5;
      }
      yPosition += 5;
    });

    // Observations
    if (order.observations) {
      if (yPosition > 230) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text("OBSERVAÇÕES", 20, yPosition);
      yPosition += 7;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(order.observations, pageWidth - 40);
      doc.text(lines, 20, yPosition);
    }

    doc.save(`pedido_${order.orderNumber}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ToothIcon size={48} className="text-burgundy-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Pedido não encontrado</p>
          <Link href="/admin/dashboard">
            <Button className="bg-burgundy-500 hover:bg-burgundy-600">
              Voltar ao painel
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[order.status].icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/admin/dashboard">
              <Button variant="ghost" className="text-gray-600">
                <ArrowLeft size={16} className="mr-2" />
                Voltar ao painel
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <ToothIcon size={24} className="text-burgundy-500" />
              <h1 className="text-lg font-semibold text-gray-900">Detalhes do Pedido</h1>
            </div>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Order Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{order.orderNumber}</h2>
                <Badge className={statusConfig[order.status].color}>
                  <StatusIcon size={14} className="mr-1" />
                  {statusConfig[order.status].label}
                </Badge>
              </div>
              <Button onClick={exportToPDF} variant="outline" className="border-burgundy-500 text-burgundy-600">
                <FileText size={16} className="mr-2" />
                Exportar PDF
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <Calendar size={16} className="mr-2" />
                Criado: {new Date(order.createdAt).toLocaleString("pt-BR")}
              </div>
              <div className="flex items-center text-gray-600">
                <Clock size={16} className="mr-2" />
                Atualizado: {new Date(order.updatedAt).toLocaleString("pt-BR")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Update */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Atualizar Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select 
                value={selectedStatus || order.status} 
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger className="flex-1 focus:ring-burgundy-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleStatusUpdate}
                disabled={!selectedStatus || selectedStatus === order.status || updateStatusMutation.isPending}
                className="bg-burgundy-500 hover:bg-burgundy-600"
              >
                {updateStatusMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="text-burgundy-500" size={20} />
              Informações do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="font-medium">Nome:</span> {order.patientName}</p>
              {order.patientId && <p><span className="font-medium">ID:</span> {order.patientId}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Teeth Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToothIcon size={20} className="text-burgundy-500" />
              Dentes Selecionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {order.selectedTeeth.map((tooth) => (
                <Badge key={tooth.id} variant="outline" className="text-sm py-2 px-3">
                  {tooth.number} - {tooth.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tooth Configurations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Configurações dos Dentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {order.selectedTeeth.map((tooth) => {
                const config = order.toothConfigurations[tooth.id] || {};
                return (
                  <div key={tooth.id} className="border-l-4 border-burgundy-500 pl-4">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Dente {tooth.number} ({tooth.name})
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {config.workType && (
                        <div>
                          <span className="text-gray-600">Tipo:</span>{" "}
                          <span className="font-medium">{config.workType === 'com_prova' ? 'Com prova' : 'Sem prova'}</span>
                        </div>
                      )}
                      {config.material && (
                        <div>
                          <span className="text-gray-600">Material:</span>{" "}
                          <span className="font-medium">{config.material}</span>
                        </div>
                      )}
                      {config.color && (
                        <div>
                          <span className="text-gray-600">Cor:</span>{" "}
                          <span className="font-medium">{config.color}</span>
                        </div>
                      )}
                      {config.workCategory && (
                        <div>
                          <span className="text-gray-600">Categoria:</span>{" "}
                          <span className="font-medium">{config.workCategory}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Observations */}
        {order.observations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="text-burgundy-500" size={20} />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{order.observations}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
