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
Schema::create('payments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('contract_id')->constrained()->onDelete('cascade');
    $table->decimal('amount', 10, 2);
    $table->date('due_date');
    $table->enum('status', ['pending', 'paid', 'credited'])->default('pending');
    $table->text('description')->nullable();
    $table->timestamps();
});
}
    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('payments');
    }
};
