import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { insertDentalOrderSchema, type InsertDentalOrder, type DentalOrder } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import ToothSelection from "@/components/tooth-selection";
import ToothConfiguration from "@/components/tooth-configuration";
import { User, Utensils, ClipboardList, FileText, Clock, CheckCircle, Send, Upload, Image, FileBox, X, Settings } from "lucide-react";
import ToothIcon from "@/components/tooth-icon";
import jsPDF from "jspdf";

export default function DentalOrderForm() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTeeth, setSelectedTeeth] = useState<Array<{ number: string; name: string; id: string }>>([]);
  const [toothConfigurations, setToothConfigurations] = useState<Record<string, any>>({});
  const [currentDateTime, setCurrentDateTime] = useState(new Date().toLocaleString('pt-BR'));
  const [smilePhotoFile, setSmilePhotoFile] = useState<File | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [smilePhotoPath, setSmilePhotoPath] = useState<string>("");
  const [scannerFilePath, setScannerFilePath] = useState<string>("");
  const [isUploadingSmile, setIsUploadingSmile] = useState(false);
  const [isUploadingScanner, setIsUploadingScanner] = useState(false);

  const form = useForm<InsertDentalOrder>({
    resolver: zodResolver(insertDentalOrderSchema),
    defaultValues: {
      patientName: "",
      patientId: "",
      selectedTeeth: [],
      toothConfigurations: {},
      observations: "",
    },
  });

  // Update date/time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSmilePhotoUpload = async (file: File) => {
    setIsUploadingSmile(true);
    try {
      const formData = new FormData();
      formData.append("smilePhoto", file);

      const response = await fetch("/api/upload/smile-photo", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload falhou");
      }

      setSmilePhotoPath(result.filePath);
      setSmilePhotoFile(file);
      
      toast({
        title: "Sucesso!",
        description: "Foto do sorriso enviada com sucesso",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao enviar a foto. Tente novamente.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingSmile(false);
    }
  };

  const handleScannerFileUpload = async (file: File) => {
    setIsUploadingScanner(true);
    try {
      const formData = new FormData();
      formData.append("scannerFile", file);

      const response = await fetch("/api/upload/scanner-file", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload falhou");
      }

      setScannerFilePath(result.filePath);
      setScannerFile(file);
      
      toast({
        title: "Sucesso!",
        description: "Arquivo de escaneamento enviado com sucesso",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao enviar o arquivo. Tente novamente.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingScanner(false);
    }
  };

  const validateForm = (): boolean => {
    const patientName = form.getValues("patientName");
    
    if (!patientName?.trim()) {
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha o nome do paciente",
        variant: "destructive",
      });
      return false;
    }

    if (selectedTeeth.length === 0) {
      toast({
        title: "Erro de validação", 
        description: "Por favor, selecione pelo menos um dente",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };


  const submitOrder = async () => {
    if (!validateForm()) return;

    const formData = {
      ...form.getValues(),
      selectedTeeth,
      toothConfigurations,
      smilePhotoPath,
      scannerFilePath,
    };

    try {
      const response = await fetch("/api/dental-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save order");
      }

      const result = await response.json();
      const savedOrder = result.order;

      toast({
        title: "Pedido Enviado!",
        description: `Número do pedido: ${savedOrder.orderNumber}`,
        duration: 5000,
      });

      // Reset form after successful submission
      form.reset();
      setSelectedTeeth([]);
      setToothConfigurations({});
      setSmilePhotoFile(null);
      setScannerFile(null);
      setSmilePhotoPath("");
      setScannerFilePath("");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao enviar o pedido. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async () => {
    if (!validateForm()) return;

    const formData = {
      ...form.getValues(),
      selectedTeeth,
      toothConfigurations,
    };

    // Save to database first
    try {
      const response = await fetch("/api/dental-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save order");
      }

      const result = await response.json();
      const savedOrder = result.order;

      // Now generate PDF with order number
      generatePDF(savedOrder);

      toast({
        title: "PDF Gerado!",
        description: `Pedido ${savedOrder.orderNumber} salvo e PDF baixado`,
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao gerar PDF. Tente novamente.",
        variant: "destructive",
      });
      return;
    }
  };

  const generatePDF = (orderData: any) => {
    const formData = {
      ...form.getValues(),
      selectedTeeth,
      toothConfigurations,
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Helper function to add text with automatic line breaking
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 12) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * (fontSize * 0.35));
    };

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("LABORATÓRIO ODONTOLÓGICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Ordem de Serviço Odontológica", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;

    // Order Number
    if (orderData?.orderNumber) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Pedido: ${orderData.orderNumber}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;
    }

    // Date/Time
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - 20, yPosition, { align: "right" });
    yPosition += 15;

    // Patient Information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES DO PACIENTE", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${formData.patientName}`, 20, yPosition);
    yPosition += 6;
    
    if (formData.patientId && formData.patientId.trim()) {
      doc.text(`ID: ${formData.patientId}`, 20, yPosition);
      yPosition += 6;
    }
    
    yPosition += 9;

    // Selected Teeth
    if (selectedTeeth.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("DENTES SELECIONADOS", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const teethNumbers = selectedTeeth.map(tooth => tooth.number).join(", ");
      yPosition = addWrappedText(`Dentes: ${teethNumbers}`, 20, yPosition, pageWidth - 40);
      yPosition += 10;

      // Tooth Configurations
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("CONFIGURAÇÕES DOS DENTES", 20, yPosition);
      yPosition += 10;

      selectedTeeth.forEach((tooth) => {
        const config = toothConfigurations[tooth.id] || {};
        
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Dente ${tooth.number} (${tooth.name})`, 20, yPosition);
        yPosition += 6;

        doc.setFont("helvetica", "normal");
        
        if (config.workType) {
          doc.text(`• Tipo de Trabalho: ${config.workType === 'com_prova' ? 'Com prova' : 'Sem prova'}`, 25, yPosition);
          yPosition += 5;
        }
        
        if (config.material) {
          let materialText = config.material;
          if (config.material === 'zirconia') materialText = 'Zircônia';
          else if (config.material === 'pmma') materialText = 'PMMA';
          else if (config.material === 'dissilicato') materialText = 'Dissilicato de Lítio';
          
          doc.text(`• Material: ${materialText}`, 25, yPosition);
          yPosition += 5;
        }
        
        if (config.color) {
          doc.text(`• Cor: ${config.color}`, 25, yPosition);
          yPosition += 5;
        }
        
        if (config.workCategory) {
          let categoryText = config.workCategory;
          if (config.workCategory === 'coroa') categoryText = 'Coroa';
          else if (config.workCategory === 'pontes') categoryText = 'Pontes';
          else if (config.workCategory === 'facetas') categoryText = 'Facetas';
          else if (config.workCategory === 'implantes') categoryText = 'Implantes';
          
          doc.text(`• Categoria: ${categoryText}`, 25, yPosition);
          yPosition += 5;
        }
        
        if (config.workCategory === 'implantes') {
          if (config.implantBrand) {
            doc.text(`• Marca do Implante: ${config.implantBrand}`, 25, yPosition);
            yPosition += 5;
          }
          if (config.implantModel) {
            doc.text(`• Modelo do Implante: ${config.implantModel}`, 25, yPosition);
            yPosition += 5;
          }
          if (config.implantDiameter) {
            doc.text(`• Diâmetro: ${config.implantDiameter}mm`, 25, yPosition);
            yPosition += 5;
          }
          if (config.implantLength) {
            doc.text(`• Comprimento: ${config.implantLength}mm`, 25, yPosition);
            yPosition += 5;
          }
          if (config.healing) {
            let healingText = config.healing;
            if (config.healing === 'submerso') healingText = 'Submerso';
            else if (config.healing === 'transmucoso') healingText = 'Transmucoso';
            
            doc.text(`• Tipo de Cicatrização: ${healingText}`, 25, yPosition);
            yPosition += 5;
          }
          if (config.prostheticConnection) {
            let connectionText = config.prostheticConnection;
            if (config.prostheticConnection === 'hexagono_externo') connectionText = 'Hexágono Externo';
            else if (config.prostheticConnection === 'hexagono_interno') connectionText = 'Hexágono Interno';
            else if (config.prostheticConnection === 'conico_morse') connectionText = 'Cônico Morse';
            
            doc.text(`• Conexão Protética: ${connectionText}`, 25, yPosition);
            yPosition += 5;
          }
        }
        
        yPosition += 5;
      });
    }

    // Observations
    if (formData.observations && formData.observations.trim()) {
      // Check if we need a new page
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("OBSERVAÇÕES", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      yPosition = addWrappedText(formData.observations, 20, yPosition, pageWidth - 40);
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
      doc.text("Sistema de Ordem de Serviço Odontológica", pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
    }

    // Save the PDF
    const patientInfo = formData.patientId && formData.patientId.trim() 
      ? `${formData.patientName.replace(/\s+/g, '_')}_ID${formData.patientId.replace(/\s+/g, '_')}`
      : formData.patientName.replace(/\s+/g, '_');
    const fileName = `ordem_servico_${patientInfo}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    toast({
      title: "Sucesso",
      description: "PDF gerado e baixado com sucesso!",
    });
  };

  const removeTooth = (toothId: string) => {
    setSelectedTeeth(prev => prev.filter(tooth => tooth.id !== toothId));
    setToothConfigurations(prev => {
      const newConfig = { ...prev };
      delete newConfig[toothId];
      return newConfig;
    });
  };

  const updateToothConfiguration = (toothId: string, config: any) => {
    setToothConfigurations(prev => ({
      ...prev,
      [toothId]: config,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <img src="/header-logo.png" alt="Logo" className="w-6 h-6" />
              <h1 className="text-xl font-semibold text-gray-900">Laboratório Odontológico</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setLocation("/admin/login")}
                className="flex items-center gap-2"
              >
                <Settings size={16} />
                Painel Administrativo
              </Button>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="text-burgundy-500" size={16} />
                <span>{currentDateTime}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Form Title */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Ordem de Serviço Odontológica</h2>
          <p className="text-gray-600">Preencha os dados do paciente e especificações técnicas</p>
        </div>


        <Form {...form}>
          <form className="space-y-8">
            {/* Patient Information Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <User className="text-burgundy-500" size={20} />
                  Informações do Paciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="patientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Paciente *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Digite o nome completo do paciente"
                              {...field}
                              className="focus:ring-burgundy-500 focus:border-burgundy-500"
                              data-testid="input-patient-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <FormField
                      control={form.control}
                      name="patientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID do Paciente</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="ID ou código do paciente"
                              {...field}
                              className="focus:ring-burgundy-500 focus:border-burgundy-500"
                              data-testid="input-patient-id"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tooth Selection Section */}
            <ToothSelection
              selectedTeeth={selectedTeeth}
              onTeethChange={setSelectedTeeth}
              onRemoveTooth={removeTooth}
            />

            {/* Dynamic Tooth Configuration Sections */}
            <div className="space-y-6">
              {selectedTeeth.map((tooth) => (
                <ToothConfiguration
                  key={tooth.id}
                  tooth={tooth}
                  configuration={toothConfigurations[tooth.id] || {}}
                  onConfigurationChange={(config) => updateToothConfiguration(tooth.id, config)}
                  onRemove={() => removeTooth(tooth.id)}
                />
              ))}
            </div>

            {/* Observations Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ClipboardList className="text-burgundy-500" size={20} />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Adicionais</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Insira observações, instruções especiais ou detalhes adicionais..."
                          rows={4}
                          {...field}
                          className="focus:ring-burgundy-500 focus:border-burgundy-500 resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Upload className="text-burgundy-500" size={20} />
                  Arquivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Smile Photo Upload */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Foto do Sorriso
                    </label>
                    <div className="flex flex-col items-center justify-center w-full">
                      <label
                        htmlFor="smile-photo-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Image className="w-8 h-8 mb-2 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Clique para enviar</span> ou arraste
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG (MAX. 50MB)</p>
                        </div>
                        <input
                          id="smile-photo-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSmilePhotoUpload(file);
                          }}
                          disabled={isUploadingSmile}
                        />
                      </label>
                      {smilePhotoFile && (
                        <div className="mt-3 w-full">
                          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Image className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-700 truncate max-w-[200px]">
                                {smilePhotoFile.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSmilePhotoFile(null);
                                setSmilePhotoPath("");
                              }}
                              className="text-green-600 hover:text-green-800"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                      {isUploadingSmile && (
                        <p className="mt-2 text-sm text-gray-500">Enviando...</p>
                      )}
                    </div>
                  </div>

                  {/* Scanner File Upload */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Arquivo de Escaneamento
                    </label>
                    <div className="flex flex-col items-center justify-center w-full">
                      <label
                        htmlFor="scanner-file-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileBox className="w-8 h-8 mb-2 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Clique para enviar</span> ou arraste
                          </p>
                          <p className="text-xs text-gray-500">STL, OBJ, PLY, ZIP (MAX. 200MB)</p>
                        </div>
                        <input
                          id="scanner-file-upload"
                          type="file"
                          className="hidden"
                          accept=".stl,.obj,.ply,.zip"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleScannerFileUpload(file);
                          }}
                          disabled={isUploadingScanner}
                        />
                      </label>
                      {scannerFile && (
                        <div className="mt-3 w-full">
                          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileBox className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-700 truncate max-w-[200px]">
                                {scannerFile.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setScannerFile(null);
                                setScannerFilePath("");
                              }}
                              className="text-green-600 hover:text-green-800"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                      {isUploadingScanner && (
                        <p className="mt-2 text-sm text-gray-500">Enviando...</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">                  
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button 
                      type="button"
                      onClick={submitOrder}
                      className="bg-burgundy-600 hover:bg-burgundy-700 text-white"
                    >
                      <Send className="mr-2" size={16} />
                      Enviar Pedido
                    </Button>
                    <Button 
                      type="button"
                      onClick={exportToPDF}
                      variant="secondary"
                      className="bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      <FileText className="mr-2" size={16} />
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img src="/tooth-selection-icon.png" alt="Logo" className="w-5 h-5" />
              <span className="text-gray-600 font-medium">Sistema de Ordem de Serviço Odontológica</span>
            </div>
            <div className="text-gray-500 text-sm">
              © 2024 Laboratório Odontológico. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
