<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('type')->default('mcq')->after('class_name');
            $table->text('answer')->nullable()->after('correct_option');
            $table->boolean('answerBool')->nullable()->after('answer');
            
            $table->string('option_a')->nullable()->change();
            $table->string('option_b')->nullable()->change();
            $table->string('option_c')->nullable()->change();
            $table->string('option_d')->nullable()->change();
            $table->string('correct_option', 1)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn(['type', 'answer', 'answerBool']);
            $table->string('option_a')->nullable(false)->change();
            $table->string('option_b')->nullable(false)->change();
            $table->string('option_c')->nullable(false)->change();
            $table->string('option_d')->nullable(false)->change();
            $table->string('correct_option', 1)->nullable(false)->change();
        });
    }
};
