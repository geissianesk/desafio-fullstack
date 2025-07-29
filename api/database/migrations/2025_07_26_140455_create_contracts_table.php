<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
public function up()
{
    Schema::create('contracts', function (Blueprint $table) {
        $table->id();
        $table->foreignId('user_id')->constrained('users');
        $table->foreignId('plan_id')->constrained('plans');
        $table->enum('status', ['active', 'inactive'])->default('inactive');
        $table->date('started_at');
        $table->date('ended_at')->nullable();
        $table->timestamps();
        $table->date('next_billing_date')->after('ended_at');
        $table->decimal('monthly_amount', 10, 2)->after('plan_id');
    });
}
    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('contracts');
    }
};
