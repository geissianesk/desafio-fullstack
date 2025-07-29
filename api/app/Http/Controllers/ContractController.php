<?php

namespace App\Http\Controllers;

use App\Models\Contract;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContractController extends Controller
{
    public function active($userId)
    {
        $contract = Contract::with('plan')
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->first();

        return response()->json([
            'contract' => $contract,
            'message' => $contract ? 'Contrato ativo encontrado' : 'Nenhum contrato ativo'
        ]);
    }

    public function history($userId)
    {
        $contracts = Contract::with('plan')
            ->where('user_id', $userId)
            ->orderBy('started_at', 'desc')
            ->get();

        return response()->json([
            'contracts' => $contracts,
            'count' => $contracts->count()
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'plan_id' => 'required|exists:plans,id'
        ]);

        DB::beginTransaction();
        try {
            $user = User::find($request->user_id);
            $plan = Plan::find($request->plan_id);

            $contract = Contract::create([
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'monthly_amount' => $plan->price,
                'status' => 'active',
                'started_at' => now(),
                'next_billing_date' => now()->addMonth(),
                'applied_credit' => $credit,
                'previous_plan_id' => $currentContract->plan_id,
            ]);

            Payment::create([
                'contract_id' => $contract->id,
                'amount' => $plan->price,
                'due_date' => $contract->next_billing_date,
                'status' => 'paid',
                'description' => 'Pagamento inicial'
            ]);

            DB::commit();

            return response()->json([
                'contract' => $contract->load('plan'),
                'message' => 'Contrato criado com sucesso!'
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Falha ao criar contrato: ' . $e->getMessage()
            ], 500);
        }
    }

    public function upgrade(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'plan_id' => 'required|exists:plans,id'
        ]);

        DB::beginTransaction();
        try {
            $user = User::find($request->user_id);
            $newPlan = Plan::find($request->plan_id);
            $currentContract = $user->activeContract();

            if (!$currentContract) {
                return response()->json([
                    'error' => 'Usuário não possui contrato ativo'
                ], 400);
            }

            $currentContract->update([
                'status' => 'inactive',
                'ended_at' => now()
            ]);

            $daysUsed = Carbon::parse($currentContract->started_at)->diffInDays(now());
            $daysInMonth = Carbon::parse($currentContract->started_at)->daysInMonth;
            $dailyRate = $currentContract->monthly_amount / $daysInMonth;
            $credit = $dailyRate * ($daysInMonth - $daysUsed);

            $originalDay = Carbon::parse($currentContract->started_at)->day;
            $nextBillingDate = now()->day($originalDay);

            if ($nextBillingDate->lessThan(now())) {
                $nextBillingDate->addMonth();
            }

            $newContract = Contract::create([
                'user_id' => $user->id,
                'plan_id' => $newPlan->id,
                'monthly_amount' => $newPlan->price,
                'status' => 'active',
                'started_at' => now(),
                'next_billing_date' => $nextBillingDate,
            ]);

            $adjustedAmount = max($newPlan->price - $credit, 0);

            $payment = Payment::create([
                'contract_id' => $newContract->id,
                'amount' => $adjustedAmount,
                'due_date' => $newContract->next_billing_date,
                'status' => 'paid',
                'description' => 'Pagamento ajustado - crédito de R$ ' . number_format($credit, 2)
            ]);

            Payment::where('contract_id', $currentContract->id)
                ->where('status', 'pending')
                ->update(['status' => 'credited']);

            DB::commit();

            return response()->json([
                'contract' => $newContract->load('plan'),
                'payment' => $payment,
                'credit_applied' => $credit,
                'message' => 'Plano alterado com sucesso!'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Falha na alteração do plano: ' . $e->getMessage()
            ], 500);
        }
    }
}
