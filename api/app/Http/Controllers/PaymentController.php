<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        
        $payments = Payment::with('contract')
            ->whereHas('contract', function($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->orderBy('due_date', 'asc')
            ->get();

        return response()->json([
            'payments' => $payments,
            'count' => $payments->count()
        ]);
    }
}