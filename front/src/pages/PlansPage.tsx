import { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
};

type Plan = {
  id: number;
  description: string;
  price: number;
  gigabytesStorage: number;
  numberOfClients: number;
};

type Contract = {
  id: number;
  plan: Plan;
  status: "active" | "inactive";
  started_at: string;
  ended_at?: string;
  monthly_amount: number;
   applied_credit: number;
   remaining_credit?: number; 
};

type CreditHistory = {
  id: number;
  amount: number;
  description: string;
  date: string;
  contract_id: number;
};

type Payment = {
  id: number;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "credited";
  description: string;
};

type ModalMessage = {
  title: string;
  message: string;
  type: "success" | "error" | "info";
};

type PaymentSimulation = {
  previousPlan: Plan | null;
  newPlan: Plan;
  daysUsed: number;
  creditAmount: number;
  newMonthlyAmount: number;
  nextPaymentDate: string;
};

export function PlansPage() {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [contractHistory, setContractHistory] = useState<Contract[]>([]);
  const [selectedHistoryContract, setSelectedHistoryContract] =
    useState<Contract | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<Plan | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [modalMessage, setModalMessage] = useState<ModalMessage>({
    title: "",
    message: "",
    type: "info",
  });
  const [paymentSimulation, setPaymentSimulation] =
    useState<PaymentSimulation | null>(null);
  const [showPaymentSimulation, setShowPaymentSimulation] = useState(false);

  const handleCloseModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowUpgradeModal(false);
      setSelectedPlan(null);
      setPixCode(null);
      setShowMessageModal(false);
      setShowPaymentSimulation(false);
    }
  };

const handleGeneratePix = async (paymentId: number) => {
  try {
    const pixCode = generatePixCode();
    
    const response = await fetch(`http://localhost:8000/api/payments/${paymentId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pix_code: pixCode })
    });

    if (response.ok) {
      setPayments(payments.map(p => 
        p.id === paymentId ? { ...p, status: 'paid' } : p
      ));
      
      showMessage("Sucesso!", "Pagamento confirmado via PIX", "success");
    }
  } catch (error) {
    showMessage("Erro", "Falha ao processar PIX", "error");
  }
};

  const handleUseCredit = async (creditId: number, paymentId: number) => {
  try {
    const response = await fetch('http://localhost:8000/api/use-credit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credit_id: creditId,
        payment_id: paymentId
      }),
    });

    if (!response.ok) throw new Error('Falha ao usar crédito');

    const updatedPayments = payments.map(p => 
      p.id === paymentId ? { ...p, status: 'paid' } : p
    );
    setPayments(updatedPayments);

    const updatedCredits = creditHistory.map(c => 
      c.id === creditId ? { ...c, is_used: true } : c
    );
    setCreditHistory(updatedCredits);

    setSelectedPayment(null);
    showMessage("Sucesso", "Crédito aplicado com sucesso!", "success");

  } catch (error) {
    showMessage("Erro", error.message, "error");
  }
};

  useEffect(() => {
    async function loadData() {
      try {
        // Buscando o usuário "logado"
        const userResponse = await fetch(
          "http://localhost:8000/api/first-user"
        );
        const userLogado = await userResponse.json();
        const userId = userLogado.id;

        const [userRes, plansRes, activeRes, historyRes, paymentsRes, creditsRes] =
          await Promise.all([
            fetch(`http://localhost:8000/api/user/${userId}`),
            fetch("http://localhost:8000/api/plans"),
            fetch(`http://localhost:8000/api/contract-active/${userId}`),
            fetch(`http://localhost:8000/api/contracts/${userId}`),
            fetch(`http://localhost:8000/api/payments?user_id=${userId}`),
            fetch(`http://localhost:8000/api/credits?user_id=${userId}`),
          ]);

          const creditsData = creditsRes.ok ? await creditsRes.json() : [];
        const userData = await userRes.json();
        const plansData = await plansRes.json();
        const activeData = activeRes.ok
          ? await activeRes.json()
          : { contract: null };
        const historyData = await historyRes.json();
        const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];

        setCreditHistory(creditsData);
        setUser(userData);
        setPlans(plansData);
        setActiveContract(activeData.contract);
        setContractHistory(historyData.contracts || historyData);
        setPayments(paymentsData);
      } catch (error) {
        showMessage("Erro", "Falha ao carregar dados", "error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const generatePixCode = () => {
    return (
      "00020126360014BR.GOV.BCB.PIX0114+5599999999995204000053039865405" +
      (Math.random() * 100 + 1).toFixed(2).replace(".", "") +
      "5802BR5920Assinatura Plano6009SaoPaulo62070503***6304"
    );
  };

  const showMessage = (
    title: string,
    message: string,
    type: "success" | "error" | "info"
  ) => {
    setModalMessage({ title, message, type });
    setShowMessageModal(true);
  };

  const handlePlanClick = (plan: Plan) => {
    if (activeContract?.plan.id === plan.id) {
      showMessage("Atenção", "Você já possui este plano ativo!", "info");
      return;
    }

    if (activeContract) {
      setUpgradePlan(plan);
      setShowUpgradeModal(true);
    } else {
      setSelectedPlan(plan);
      setPixCode(generatePixCode());
    }
  };

const handleSimulatePayment = async () => {
  if (!selectedPlan || !user) return;

  try {
    // Calcula créditos se for upgrade/downgrade
    const credit = 0;
    let daysUsed = 0;
    let nextPaymentDate = new Date().toISOString().split('T')[0]; // Data atual como padrão

if (activeContract) {
      const startDate = new Date(activeContract.started_at);
      const today = new Date();
      daysUsed = Math.floor(
        (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

        const originalDueDate = new Date(startDate);
        originalDueDate.setMonth(originalDueDate.getMonth() + 1); 
        nextPaymentDate = originalDueDate.toISOString().split('T')[0];
}

    // Calcula o valor líquido do primeiro pagamento (aplicando o crédito)
    const firstPaymentAmount = Math.max(selectedPlan.price - credit, 0);
    const remainingCredit = Math.max(credit - selectedPlan.price, 0);

    // Cria os pagamentos
    const paymentsToCreate = [
      {
        amount: firstPaymentAmount,
        due_date: nextPaymentDate,
        status: "pending",
        description: `Pagamento mensal - ${selectedPlan.description}`
      }
    ];

    // Se ainda houver crédito remanescente, cria um pagamento com valor negativo
    if (remainingCredit > 0) {
      const nextMonth = new Date(nextPaymentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      paymentsToCreate.push({
        amount: -remainingCredit,
        due_date: nextMonth.toISOString().split('T')[0],
        status: "credited",
        description: `Crédito remanescente - ${selectedPlan.description}`
      });
    }

    const endpoint = activeContract ? "/contracts/upgrade" : "/contracts";
    const body = {
      user_id: user.id,
      plan_id: selectedPlan.id,
      credit_amount: credit,
      days_used: daysUsed,
      payments: paymentsToCreate,
      keep_original_due_date: true,
    };

    const response = await fetch(`http://localhost:8000/api${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falha na operação");
    }

    const data = await response.json();

    // Mostra a simulação antes de confirmar
    if (activeContract) {
      setPaymentSimulation({
        previousPlan: activeContract.plan,
        newPlan: selectedPlan,
        daysUsed,
        creditAmount: credit,
        newMonthlyAmount: selectedPlan.price,
        nextPaymentDate: nextPaymentDate,
        payments: paymentsToCreate
      });
      setShowPaymentSimulation(true);
    } else {
       confirmContract(data.contract, data.payments);
    }
  } catch (error) {
    showMessage(
      "Erro",
      error instanceof Error ? error.message : "Ocorreu um erro",
      "error"
    );
  }
};
  const confirmContract = (contract: Contract, newPayments: Payment[]) => {
    setActiveContract(contract);
    setContractHistory([contract, ...contractHistory]);
    setPayments(newPayments || payments);

    showMessage(
      "Sucesso",
      activeContract
        ? "Plano atualizado com sucesso!"
        : "Plano contratado com sucesso!",
      "success"
    );

    setSelectedPlan(null);
    setPixCode(null);
    setShowPaymentSimulation(false);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading)
    return <div className="text-center py-8">Carregando dados...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Bem-vindo, {user?.name}!</h1>

      {/* Plano Ativo */}
      {activeContract ? (
        <div className="bg-green-100 border border-green-400 text-green-800 p-4 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <strong>Plano Ativo:</strong> {activeContract.plan?.description} -
              R$ {formatPrice(activeContract.monthly_amount)} / mês
              <div className="text-sm mt-1">
                Próximo pagamento:{" "}
                {(() => {
                  const [ano, mes, dia] = activeContract.started_at
                    .split("-")
                    .map(Number);
                  const data = new Date(ano, mes - 1, dia);
                  data.setMonth(data.getMonth() + 1);
                  return data.toLocaleDateString("pt-BR");
                })()}
              </div>
            </div>
            <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">
              Ativo
            </span>
          </div>
        </div>
      ) : (
        <div className="text-gray-600 mb-6">
          Você ainda não possui um plano ativo.
        </div>
      )}

      {/* Pagamentos Pendentes */}
      {payments.filter((p) => p.status === "pending").length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Pagamentos Pendentes</h2>
          <div className="space-y-2">
            {payments
              .filter((p) => p.status === "pending")
              .map((payment) => (
                <div
                  key={payment.id}
                  className="border p-3 rounded-md bg-yellow-50"
                >
                  <div className="flex justify-between">
                    <span>
                      Vencimento:{" "}
                      {new Date(payment.due_date).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="font-semibold">
                      R$ {formatPrice(payment.amount)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {payment.description}
                  </div>
                  <button 
              onClick={() => setSelectedPayment(payment)}
              className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2 hover:bg-green-600 transition"
              title="Usar créditos"
            >
            </button>
                  <button
        onClick={() => handleGeneratePix(payment.id)}
        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded ml-4 text-sm"
      >
Marcar como pago
      </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal de Uso de Créditos */}
{selectedPayment && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Usar Créditos</h2>
        
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold">Pagamento Pendente</h3>
          <p>Valor: R$ {formatPrice(selectedPayment.amount)}</p>
          <p>Vencimento: {new Date(selectedPayment.due_date).toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold mb-2">Seus Créditos Disponíveis</h3>
          {creditHistory
            .filter(credit => !credit.is_used && new Date(credit.expires_at) > new Date())
            .map(credit => (
              <div key={credit.id} className="flex items-center justify-between p-2 border-b">
                <div>
                  <p>R$ {formatPrice(credit.amount)}</p>
                  <p className="text-xs text-gray-500">
                    Expira em: {new Date(credit.expires_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button 
                  onClick={() => handleUseCredit(credit.id, selectedPayment.id)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                >
                  Usar
                </button>
              </div>
            ))}
        </div>

        <button
          onClick={() => setSelectedPayment(null)}
          className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
)}

      {/* Planos disponíveis */}
      <h2 className="text-xl font-semibold mb-4">Planos Disponíveis</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`cursor-pointer bg-white rounded-lg shadow-md border overflow-hidden hover:ring-2 ring-blue-500 transition ${
              activeContract?.plan.id === plan.id
                ? "border-green-500 bg-green-50"
                : "border-gray-200"
            }`}
            onClick={() => handlePlanClick(plan)}
          >
            <div className="bg-orange-500 text-white text-sm font-semibold px-4 py-2">
              {plan.description}
              {activeContract?.plan.id === plan.id && (
                <span className="ml-2 bg-white text-orange-500 px-2 py-0.5 rounded-full text-xs">
                  Atual
                </span>
              )}
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-gray-600 text-sm font-medium">Preço:</div>
                <div className="text-2xl font-bold text-gray-800">
                  R$ {formatPrice(plan.price)}
                  <span className="text-base font-normal text-gray-500">
                    {" "}
                    /mês
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-gray-600 text-sm font-medium">
                    Armazenamento:
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {plan.gigabytesStorage} GB
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-sm font-medium">
                    Clientes:
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {plan.numberOfClients}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Histórico de contratos */}
      <h2 className="text-xl font-semibold mb-4">Histórico de Contratos</h2>
      {contractHistory.length === 0 ? (
        <p className="text-gray-500 mb-6">Nenhum contrato encontrado.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {contractHistory.map((contract) => (
            <div
              key={contract.id}
              className="border p-4 rounded-md bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
              onClick={() => setSelectedHistoryContract(contract)}
            >
              <div className="flex justify-between items-start">
                <div className="font-semibold">
                  {contract.plan?.description}
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    contract.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {contract.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <div className="text-sm text-gray-600">
                  <div>Valor:</div>
                  <div className="font-medium">
                    R$ {formatPrice(contract.monthly_amount)}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Início:</div>
                  <div className="font-medium">
                    {(() => {
                      const [ano, mes, dia] = contract.started_at.split("-");
                      return `${dia}/${mes}/${ano}`;
                    })()}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Término:</div>
                  <div className="font-medium">
                    {contract.ended_at
                      ? new Date(contract.ended_at).toLocaleDateString("pt-BR")
                      : "---"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

{/* Modal de Histórico */}
{selectedHistoryContract && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold">Detalhes do Contrato</h2>
        <button 
          onClick={() => setSelectedHistoryContract(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Informações Básicas do Contrato */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Plano</h3>
          <p className="font-medium">{selectedHistoryContract.plan.description}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Valor Mensal</h3>
          <p className="font-medium">R$ {Number(selectedHistoryContract.monthly_amount).toFixed(2)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Início</h3>
          <p>{new Date(selectedHistoryContract.started_at).toLocaleDateString('pt-BR')}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Término</h3>
          <p>
            {selectedHistoryContract.ended_at 
              ? new Date(selectedHistoryContract.ended_at).toLocaleDateString('pt-BR') 
              : 'Atual'}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 my-4"></div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Movimentações</h3>
        
        {selectedHistoryContract.applied_credit > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-1 rounded-full">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-blue-800">Crédito Aplicado</h4>
                <p className="text-blue-600">R$ {selectedHistoryContract.applied_credit.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {selectedHistoryContract.remaining_credit > 0 && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2">
              <div className="bg-green-100 p-1 rounded-full">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-green-800">Saldo Disponível</h4>
                <p className="text-green-600">R$ {selectedHistoryContract.remaining_credit.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Linha do Tempo
          </h4>
          
          <div className="space-y-3">
            {payments
              .filter((p) => p.contract_id === selectedHistoryContract.id)
              .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
              .map((payment) => (
                <div key={payment.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 ${
                      payment.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                    {payment.amount < 0 && (
                      <div className="w-px h-full bg-gray-200"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className={`p-3 rounded-lg ${
                      payment.amount > 0 
                        ? 'bg-red-50 border border-red-100' 
                        : 'bg-green-50 border border-green-100'
                    }`}>
                      <div className="flex justify-between">
                        <span className={`font-medium ${
                          payment.amount > 0 ? 'text-red-800' : 'text-green-800'
                        }`}>
                          {payment.amount > 0 ? 'Pagamento' : 'Crédito'}
                        </span>
                        <span className={`font-bold ${
                          payment.amount > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {payment.amount > 0 ? '-' : '+'}R$ {Math.abs(payment.amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-500">
                          {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          payment.status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setSelectedHistoryContract(null)}
        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
      >
        Fechar
      </button>
    </div>
  </div>
)}

      {/* Modal de Mensagem */}
      {showMessageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
            <h2
              className={`text-xl font-bold mb-2 ${
                modalMessage.type === "success"
                  ? "text-green-600"
                  : modalMessage.type === "error"
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {modalMessage.title}
            </h2>
            <p className="text-gray-700 mb-4">{modalMessage.message}</p>
            <button
              onClick={() => setShowMessageModal(false)}
              className={`w-full ${
                modalMessage.type === "success"
                  ? "bg-green-600 hover:bg-green-700"
                  : modalMessage.type === "error"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white py-2 rounded transition`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Upgrade */}
      {showUpgradeModal && upgradePlan && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">Alterar Plano</h2>

            {activeContract && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <div className="font-semibold">Plano Atual:</div>
                <div>
                  {activeContract.plan.description} (R${" "}
                  {formatPrice(activeContract.monthly_amount)})
                </div>
                <div className="text-sm text-gray-500">
                  Desde{" "}
                  {new Date(activeContract.started_at).toLocaleDateString(
                    "pt-BR"
                  )}
                </div>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="font-semibold">Novo Plano:</div>
              <div>
                {upgradePlan.description} (R$ {formatPrice(upgradePlan.price)})
              </div>
              <div className="text-sm text-gray-500">
                {upgradePlan.gigabytesStorage} GB de armazenamento •{" "}
                {upgradePlan.numberOfClients} clientes
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setSelectedPlan(upgradePlan);
                  setPixCode(generatePixCode());
                  setShowUpgradeModal(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
              >
                Confirmar Alteração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento PIX */}
      {selectedPlan && pixCode && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-2">
              {activeContract ? "Atualização de Plano" : "Confirmação de Contratação"}
            </h2>
            <p className="text-gray-700 mb-4">
              {activeContract
                ? `Mudando para: ${selectedPlan.description}`
                : `Assinando: ${selectedPlan.description}`}
            </p>

            {/* Seção de Crédito/PIX */}
            {paymentSimulation?.creditAmount >= selectedPlan.price ? (
              // Caso 1: Crédito cobre totalmente o plano
              <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h3 className="font-semibold text-green-800">Crédito Suficiente!</h3>
                </div>
                <p className="mt-1 text-sm text-green-700">
                  Seu crédito de <strong>R$ {formatPrice(paymentSimulation.creditAmount)}</strong> cobre o valor do plano (
                  <strong>R$ {formatPrice(selectedPlan.price)}</strong>). Nenhum pagamento é necessário.
                </p>
              </div>
            ) : (
              // Caso 2: Mostrar PIX (com crédito parcial ou sem crédito)
              <>
                {paymentSimulation?.creditAmount > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h3 className="font-semibold text-blue-800">Crédito Disponível</h3>
                    <p className="text-sm text-blue-700">
                      Será aplicado um desconto de <strong>R$ {formatPrice(paymentSimulation.creditAmount)}</strong> no pagamento.
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-600">Valor a Pagar:</span>
                    <span className="font-bold">
                      R$ {formatPrice(
                        Math.max(selectedPlan.price - (paymentSimulation?.creditAmount || 0), 0)
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Código PIX (Copie e cole no seu app):</p>
                  <textarea
                    value={pixCode}
                    readOnly
                    className="w-full h-32 p-2 border rounded font-mono text-sm bg-gray-50"
                    onClick={(e) => e.currentTarget.select()}
                  />
                </div>
              </>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedPlan(null);
                  setPixCode(null);
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSimulatePayment}
                className={`flex-1 py-2 rounded transition ${
                  paymentSimulation?.creditAmount >= selectedPlan.price
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {paymentSimulation?.creditAmount >= selectedPlan.price
                  ? "Confirmar com Crédito"
                  : activeContract
                  ? "Confirmar Atualização"
                  : "Confirmar Contratação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Simulação de Pagamento */}
      {showPaymentSimulation && paymentSimulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">Resumo da Alteração</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Plano Anterior:</h3>
                <p>
                  {paymentSimulation.previousPlan?.description} (R${" "}
                  {formatPrice(paymentSimulation.previousPlan?.price || 0)})
                </p>
                <p className="text-sm text-gray-600">
                  Dias utilizados: {paymentSimulation.daysUsed}
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Novo Plano:</h3>
                <p>
                  {paymentSimulation.newPlan.description} (R${" "}
                  {formatPrice(paymentSimulation.newPlan.price)})
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded">
                <h3 className="font-semibold">Crédito Aplicado:</h3>
                <p>R$ {formatPrice(paymentSimulation.creditAmount)}</p>
                <p className="text-sm text-gray-600">
                  Valor calculado proporcionalmente aos{" "}
                  {30 - paymentSimulation.daysUsed} dias não utilizados
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Próximo Pagamento:</h3>
                <p>
                  Próximo pagamento:{" "}
                  {new Date(paymentSimulation.nextPaymentDate).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-sm text-gray-600">
                  Valor: R$ {formatPrice(paymentSimulation.newMonthlyAmount)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentSimulation(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
              >
                Voltar
              </button>
              <button
                onClick={() =>
                  confirmContract(
                    {
                      ...activeContract!,
                      plan: paymentSimulation.newPlan,
                      monthly_amount: paymentSimulation.newMonthlyAmount,
                    },
                    payments
                  )
                }
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
              >
                Confirmar Alteração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
