import { useEffect, useState } from 'react';

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
  status: 'active' | 'inactive';
  started_at: string;
  ended_at?: string;
  monthly_amount: number;
};

type Payment = {
  id: number;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'credited';
  description: string;
};

type PaymentDetails = {
  amount: number;
  date: string;
  status: string;
};

type ModalMessage = {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
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
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [contractHistory, setContractHistory] = useState<Contract[]>([]);
  const [selectedHistoryContract, setSelectedHistoryContract] = useState<Contract | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<Plan | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [modalMessage, setModalMessage] = useState<ModalMessage>({
    title: '',
    message: '',
    type: 'info'
  });
  const [paymentSimulation, setPaymentSimulation] = useState<PaymentSimulation | null>(null);
  const [showPaymentSimulation, setShowPaymentSimulation] = useState(false);

  // Fechar modal ao clicar fora
  const handleCloseModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowUpgradeModal(false);
      setSelectedPlan(null);
      setPixCode(null);
      setShowMessageModal(false);
      setShowPaymentSimulation(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        // Buscando o usuário "logado"
        const userResponse = await fetch('http://localhost:8000/api/first-user');
        const userLogado = await userResponse.json();
        const userId = userLogado.id;

        const [userRes, plansRes, activeRes, historyRes, paymentsRes] = await Promise.all([
          fetch(`http://localhost:8000/api/user/${userId}`),
          fetch('http://localhost:8000/api/plans'),
          fetch(`http://localhost:8000/api/contract-active/${userId}`),
          fetch(`http://localhost:8000/api/contracts/${userId}`),
          fetch(`http://localhost:8000/api/payments?user_id=${userId}`),
        ]);

        const userData = await userRes.json();
        const plansData = await plansRes.json();
        const activeData = activeRes.ok ? await activeRes.json() : { contract: null };
        const historyData = await historyRes.json();
        const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];

        setUser(userData);
        setPlans(plansData);
        setActiveContract(activeData.contract);
        setContractHistory(historyData.contracts || historyData);
        setPayments(paymentsData);
      } catch (error) {
        showMessage('Erro', 'Falha ao carregar dados', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const generatePixCode = () => {
    return '00020126360014BR.GOV.BCB.PIX0114+5599999999995204000053039865405' +
      (Math.random() * 100 + 1).toFixed(2).replace('.', '') +
      '5802BR5920Assinatura Plano6009SaoPaulo62070503***6304';
  };

  const showMessage = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setModalMessage({ title, message, type });
    setShowMessageModal(true);
  };

  const handlePlanClick = (plan: Plan) => {
    if (activeContract?.plan.id === plan.id) {
      showMessage('Atenção', 'Você já possui este plano ativo!', 'info');
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
      let credit = 0;
      let daysUsed = 0;
      
      if (activeContract) {
        const startDate = new Date(activeContract.started_at);
        const today = new Date();
        daysUsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calcula o valor proporcional dos dias não utilizados
        const dailyRate = activeContract.monthly_amount / 30; // Simplificação: 30 dias/mês
        const unusedDays = 30 - daysUsed;
        credit = unusedDays > 0 ? unusedDays * dailyRate : 0;
      }

      const endpoint = activeContract ? '/contracts/upgrade' : '/contracts';
      const body = {
        user_id: user.id,
        plan_id: selectedPlan.id,
        credit_amount: credit,
        days_used: daysUsed
      };

      const response = await fetch(`http://localhost:8000/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha na operação');
      }

      const data = await response.json();
      
      // Mostra a simulação antes de confirmar
      if (activeContract) {
        setPaymentSimulation({
          previousPlan: activeContract.plan,
          newPlan: selectedPlan,
          daysUsed,
          creditAmount: credit,
          newMonthlyAmount: data.contract.monthly_amount,
          nextPaymentDate: data.contract.started_at
        });
        setShowPaymentSimulation(true);
      } else {
        // Contratação nova - confirma diretamente
        confirmContract(data.contract, data.payments);
      }

    } catch (error) {
      showMessage('Erro', error instanceof Error ? error.message : 'Ocorreu um erro', 'error');
    }
  };

  // Função para confirmar a contratação/upgrade
  const confirmContract = (contract: Contract, newPayments: Payment[]) => {
    setActiveContract(contract);
    setContractHistory([contract, ...contractHistory]);
    setPayments(newPayments || payments);
    
    showMessage(
      'Sucesso', 
      activeContract ? 'Plano atualizado com sucesso!' : 'Plano contratado com sucesso!', 
      'success'
    );
    
    setSelectedPlan(null);
    setPixCode(null);
    setShowPaymentSimulation(false);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) return <div className="text-center py-8">Carregando dados...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Bem-vindo, {user?.name}!</h1>

      {/* Plano Ativo */}
      {activeContract ? (
        <div className="bg-green-100 border border-green-400 text-green-800 p-4 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <strong>Plano Ativo:</strong> {activeContract.plan?.description} - R$ {formatPrice(activeContract.monthly_amount)} / mês
              <div className="text-sm mt-1">
              Próximo pagamento: {(() => {
                const [ano, mes, dia] = activeContract.started_at.split('-').map(Number);
                const data = new Date(ano, mes - 1, dia);
                data.setMonth(data.getMonth() + 1);
                return data.toLocaleDateString('pt-BR');
              })()}
            </div>
            </div>
            <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">
              Ativo
            </span>
          </div>
        </div>
      ) : (
        <div className="text-gray-600 mb-6">Você ainda não possui um plano ativo.</div>
      )}

      {/* Pagamentos Pendentes */}
      {payments.filter(p => p.status === 'pending').length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Pagamentos Pendentes</h2>
          <div className="space-y-2">
            {payments.filter(p => p.status === 'pending').map(payment => (
              <div key={payment.id} className="border p-3 rounded-md bg-yellow-50">
                <div className="flex justify-between">
                  <span>Vencimento: {new Date(payment.due_date).toLocaleDateString('pt-BR')}</span>
                  <span className="font-semibold">R$ {formatPrice(payment.amount)}</span>
                </div>
                <div className="text-sm text-gray-600">{payment.description}</div>
              </div>
            ))}
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
              activeContract?.plan.id === plan.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
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
                  <span className="text-base font-normal text-gray-500"> /mês</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-gray-600 text-sm font-medium">Armazenamento:</div>
                  <div className="text-lg font-bold text-gray-800">
                    {plan.gigabytesStorage} GB
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 text-sm font-medium">Clientes:</div>
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
                <div className="font-semibold">{contract.plan?.description}</div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  contract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'
                }`}>
                  {contract.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <div className="text-sm text-gray-600">
                  <div>Valor:</div>
                  <div className="font-medium">R$ {formatPrice(contract.monthly_amount)}</div>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Início:</div>
                  <div className="font-medium">
                  {(() => {
                    const [ano, mes, dia] = contract.started_at.split('-');
                    return `${dia}/${mes}/${ano}`;
                  })()}
                </div>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Término:</div>
                  <div className="font-medium">
                    {contract.ended_at ? new Date(contract.ended_at).toLocaleDateString('pt-BR') : '---'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de hisytórico */}
      {selectedHistoryContract && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-lg">
      <h2 className="text-xl font-bold mb-4">Detalhes do Contrato</h2>
      
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Plano:</h3>
          <p>{selectedHistoryContract.plan.description}</p>
        </div>
        
        <div>
          <h3 className="font-semibold">Valor Mensal:</h3>
          <p>R$ {formatPrice(selectedHistoryContract.monthly_amount)}</p>
        </div>
        
        <div>
          <h3 className="font-semibold">Período:</h3>
          <p>
            {new Date(selectedHistoryContract.started_at).toLocaleDateString('pt-BR')} 
            {' → '}
            {selectedHistoryContract.ended_at 
              ? new Date(selectedHistoryContract.ended_at).toLocaleDateString('pt-BR')
              : 'Atual'}
          </p>
        </div>
        
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Pagamentos:</h3>
          {payments
            .filter(p => p.contract_id === selectedHistoryContract.id)
            .map(payment => (
              <div key={payment.id} className="border-t pt-2">
                <p>Valor: R$ {formatPrice(payment.amount)}</p>
                <p>Data: {new Date(payment.due_date).toLocaleDateString('pt-BR')}</p>
                <p>Status: {payment.status === 'paid' ? 'Pago' : 'Pendente'}</p>
              </div>
            ))}
        </div>
      </div>

      <button
        onClick={() => setSelectedHistoryContract(null)}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
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
            <h2 className={`text-xl font-bold mb-2 ${
              modalMessage.type === 'success' ? 'text-green-600' : 
              modalMessage.type === 'error' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {modalMessage.title}
            </h2>
            <p className="text-gray-700 mb-4">{modalMessage.message}</p>
            <button
              onClick={() => setShowMessageModal(false)}
              className={`w-full ${
                modalMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                modalMessage.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
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
                <div>{activeContract.plan.description} (R$ {formatPrice(activeContract.monthly_amount)})</div>
                <div className="text-sm text-gray-500">
                  Desde {new Date(activeContract.started_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            )}
            
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="font-semibold">Novo Plano:</div>
              <div>{upgradePlan.description} (R$ {formatPrice(upgradePlan.price)})</div>
              <div className="text-sm text-gray-500">
                {upgradePlan.gigabytesStorage} GB de armazenamento • {upgradePlan.numberOfClients} clientes
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
            <h2 className="text-xl font-bold mb-2">Pagamento via PIX</h2>
            <p className="text-gray-700 mb-4">
              {activeContract 
                ? `Atualizando para o plano ${selectedPlan.description}`
                : `Assinando o plano ${selectedPlan.description}`
              }
            </p>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Código PIX:</p>
              <textarea
                value={pixCode}
                readOnly
                className="w-full h-32 p-2 border rounded font-mono text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedPlan(null);
                  setPixCode(null);
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleSimulatePayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
              >
                {activeContract ? 'Confirmar Atualização' : 'Confirmar Contratação'}
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
                <p>{paymentSimulation.previousPlan?.description} (R$ {formatPrice(paymentSimulation.previousPlan?.price || 0)})</p>
                <p className="text-sm text-gray-600">Dias utilizados: {paymentSimulation.daysUsed}</p>
              </div>
              
              <div>
                <h3 className="font-semibold">Novo Plano:</h3>
                <p>{paymentSimulation.newPlan.description} (R$ {formatPrice(paymentSimulation.newPlan.price)})</p>
              </div>
              
              <div className="p-3 bg-blue-50 rounded">
                <h3 className="font-semibold">Crédito Aplicado:</h3>
                <p>R$ {formatPrice(paymentSimulation.creditAmount)}</p>
                <p className="text-sm text-gray-600">
                  Valor calculado proporcionalmente aos {30 - paymentSimulation.daysUsed} dias não utilizados
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold">Próximo Pagamento:</h3>
                <p>{new Date(paymentSimulation.nextPaymentDate).toLocaleDateString('pt-BR')}</p>
                <p className="text-sm text-gray-600">Valor: R$ {formatPrice(paymentSimulation.newMonthlyAmount)}</p>
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
  onClick={() => confirmContract(
    {
      ...activeContract!,
      plan: paymentSimulation.newPlan,
      monthly_amount: paymentSimulation.newMonthlyAmount
    },
    payments
  )}
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