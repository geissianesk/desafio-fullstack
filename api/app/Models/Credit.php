<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Credit extends Model
{
    use HasFactory;

protected $fillable = [
    'user_id',
    'contract_id',
    'amount',
    'description',
    'expires_at',
    'is_used'
];

public function user()
{
    return $this->belongsTo(User::class);
}

public function contract()
{
    return $this->belongsTo(Contract::class);
}

}