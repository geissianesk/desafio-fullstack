<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'contract_id',
        'amount',
        'due_date',
        'status',
        'description'
    ];

    protected $casts = [
        'due_date' => 'date',
        'amount' => 'decimal:2'
    ];

    public function contract()
    {
        return $this->belongsTo(Contract::class);
    }
}