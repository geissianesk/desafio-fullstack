<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Response;
use App\Models\Plan;
use App\Models\User;
use App\Models\Contract;
use App\Models\Credit;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

Route::get('/plans', function () {
    return Plan::where('active', true)
               ->orderBy('price', 'asc')
               ->get();
});

Route::get('/user/{id}', function ($id) {
    return User::findOrFail($id);
});

Route::post('/payments/{id}/pay', function ($paymentId, Request $request) {
    $payment = Payment::findOrFail($paymentId);
    
    $payment->update([
        'status' => 'paid',
        'paid_at' => now(),
        'pix_code' => $request->pix_code
    ]);

    return response()->json(['success' => true]);
});


Route::get('/first-user', function () {
    try {
        $user = User::first();
        
        if (!$user) {
            return response()->json(['error' => 'Nenhum usuário encontrado'], 404);
        }

        return response()->json($user);
        
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

Route::get('/contract-active/{userId}', function ($userId) {
    $contract = Contract::with('plan')
        ->where('user_id', $userId)
        ->where('status', 'active')
        ->first();

    return response()->json([
        'contract' => $contract,
    ]);
});

Route::get('/contracts/{userId}', function ($userId) {
    return Contract::with('plan')
        ->where('user_id', $userId)
        ->orderBy('started_at', 'desc')
        ->get();
});

Route::post('/contracts', function (Request $request) {
    $validated = $request->validate([
        'user_id' => 'required|exists:users,id',
        'plan_id' => 'required|exists:plans,id',
    ]);

    Contract::where('user_id', $validated['user_id'])
            ->where('status', 'active')
            ->update([
                'status' => 'inactive',
                'ended_at' => now(),
            ]);

    $plan = Plan::find($validated['plan_id']);

    $contract = Contract::create([
        'user_id' => $validated['user_id'],
        'plan_id' => $plan->id,
        'status' => 'active',
        'started_at' => now(),
        'monthly_amount' => $plan->price,
    ]);

    return response()->json([
        'success' => true,
        'contract' => $contract->load('plan'),
    ], 201);
});


    Route::post('/contracts/upgrade', function (Request $request) {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'plan_id' => 'required|exists:plans,id',
        ]);

        $user = User::findOrFail($data['user_id']);
        $newPlan = Plan::findOrFail($data['plan_id']);
        $currentContract = $user->activeContract();

        if (!$currentContract) {
            return response()->json(['error' => 'Nenhum contrato ativo encontrado.'], 400);
        }

        $currentContract->update([
            'status' => 'inactive',
            'ended_at' => now(),
        ]);

        $newContract = Contract::create([
            'user_id' => $user->id,
            'plan_id' => $newPlan->id,
            'status' => 'active',
            'started_at' => now(),
            'monthly_amount' => $newPlan->price,
        ]);

        $payment = Payment::create([
            'contract_id' => $newContract->id,
            'amount' => $newPlan->price,
            'due_date' => now()->addDays(7),
            'status' => 'paid',
            'description' => 'Pagamento do novo plano',
        ]);

        return response()->json([
            'success' => true,
            'contract' => $newContract->load('plan'),
            'payments' => [$payment],
        ]);
    });

    Route::get('/payments', function (Request $request) {
        $userId = $request->query('user_id');

        if (!$userId || !User::find($userId)) {
            return response()->json(['error' => 'Parâmetro user_id inválido'], 400);
        }

        $payments = Payment::whereHas('contract', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->orderBy('due_date', 'asc')
            ->get();

        return response()->json($payments);
    });


Route::post('/contracts', function (Request $request) {
    $validated = $request->validate([
        'user_id' => 'required|exists:users,id',
        'plan_id' => 'required|exists:plans,id'
    ]);

    DB::beginTransaction();
    try {
        $plan = Plan::findOrFail($validated['plan_id']);
        
        // Cria o contrato
        $contract = Contract::create([
            'user_id' => $validated['user_id'],
            'plan_id' => $plan->id,
            'status' => 'active',
            'started_at' => now(),
            'monthly_amount' => $plan->price,
            'next_billing_date' => now()->addMonth()
        ]);

        // Cria o primeiro pagamento
        Payment::create([
            'contract_id' => $contract->id,
            'amount' => $plan->price,
            'due_date' => $contract->next_billing_date,
            'status' => 'pending',
            'description' => 'Pagamento inicial'
        ]);

        DB::commit();

        return response()->json([
            'success' => true,
            'contract' => $contract->load('plan')
        ], 201);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

Route::post('/contracts/upgrade', function (Request $request) {
    $data = $request->validate([
        'user_id' => 'required|exists:users,id',
        'plan_id' => 'required|exists:plans,id'
    ]);

    DB::beginTransaction();
    try {
        $user = User::findOrFail($data['user_id']);
        $newPlan = Plan::findOrFail($data['plan_id']);
        $currentContract = Contract::where('user_id', $user->id)
                                ->where('status', 'active')
                                ->firstOrFail();

        // Calcula crédito proporcional
        $daysUsed = Carbon::parse($currentContract->started_at)->diffInDays(now());
        $daysInMonth = Carbon::parse($currentContract->started_at)->daysInMonth;
        $dailyRate = $currentContract->monthly_amount / $daysInMonth;
        $credit = $dailyRate * ($daysInMonth - $daysUsed);

        $currentContract->update([
            'status' => 'inactive',
            'ended_at' => now()
        ]);

        $newContract = Contract::create([
            'user_id' => $user->id,
            'plan_id' => $newPlan->id,
            'status' => 'active',
            'started_at' => now(),
            'monthly_amount' => $newPlan->price,
            'next_billing_date' => now()->addMonth()
        ]);

        $adjustedAmount = max($newPlan->price - $credit, 0);

        Payment::create([
            'contract_id' => $newContract->id,
            'amount' => $adjustedAmount,
            'due_date' => $newContract->next_billing_date,
            'status' => 'pending',
            'description' => 'Crédito de R$ ' . number_format($credit, 2) . ' aplicado'
        ]);

        DB::commit();

        return response()->json([
            'success' => true,
            'contract' => $newContract->load('plan'),
            'credit_applied' => $credit
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

Route::get('/credits', function (Request $request) {
    $userId = $request->query('user_id');

    $credits = Payment::whereHas('contract', function($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->where('status', 'credited')
            ->get();

    return response()->json($credits);
});

Route::post('/payments/credit', function (Request $request) {
    $payment = Payment::create([
        'user_id' => $request->user_id,
        'amount' => -$request->amount,
        'due_date' => $request->expires_at,
        'status' => 'credited',
        'description' => 'Crédito para futuras renovações'
    ]);
    
    return response()->json($payment);
});


Route::post('/use-credit', function (Request $request) {
    DB::transaction(function () use ($request) {
        $credit = Credit::findOrFail($request->credit_id);
        $payment = Payment::findOrFail($request->payment_id);

        if ($credit->is_used || $credit->expires_at < now()) {
            throw new \Exception("Crédito já utilizado ou expirado");
        }

        if ($payment->status !== 'pending') {
            throw new \Exception("Pagamento já foi processado");
        }

        $credit->update(['is_used' => true]);
        $payment->update([
            'status' => 'paid',
            'paid_at' => now()
        ]);
    });

    return response()->json(['success' => true]);
});