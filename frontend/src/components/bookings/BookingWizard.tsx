'use client';

import React, { useState } from 'react';
import { CustomerStep, Customer } from './steps/CustomerStep';
import { UnitSelectionStep } from './steps/UnitSelectionStep';
import { PricingStep, PricingResult } from './steps/PricingStep';
import { DepositStep, DepositResult } from './steps/DepositStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { UnitType, PriceCalculation } from '@/lib/pricing';
import { User, Calendar, CreditCard, FileCheck, CheckCircle } from 'lucide-react';

type Step = 'customer' | 'unit' | 'price' | 'deposit' | 'confirm';

export interface Unit {
  id: string;
  unit_number: string;
  floor: string;
  status: string;
  unit_type_id: string;
}

export interface BookingData {
  customer: Customer | null;
  unitType?: UnitType;
  unit?: Unit;
  startDate?: Date;
  endDate?: Date;
  priceCalculation?: PriceCalculation;
  pricingResult?: PricingResult;
  depositResult?: DepositResult;
  bookingType?: 'daily' | 'yearly';
}

const STEPS = [
  { id: 'customer', label: 'العميل', icon: User },
  { id: 'unit', label: 'الوحدة والتواريخ', icon: Calendar },
  { id: 'price', label: 'التسعير', icon: CreditCard },
  { id: 'deposit', label: 'العربون', icon: FileCheck },
  { id: 'confirm', label: 'تأكيد', icon: CheckCircle },
];

export const BookingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [bookingData, setBookingData] = useState<BookingData>({
    customer: null,
  });

  const handleCustomerSelect = (customer: Customer) => {
    setBookingData(prev => ({ ...prev, customer }));
    setCurrentStep('unit');
  };

  const handleUnitSelect = (data: { unitType: UnitType; unit: Unit; startDate: Date; endDate: Date; calculation: PriceCalculation; bookingType: 'daily' | 'yearly' }) => {
    setBookingData(prev => ({
      ...prev,
      unitType: data.unitType,
      unit: data.unit,
      startDate: data.startDate,
      endDate: data.endDate,
      priceCalculation: data.calculation,
      bookingType: data.bookingType
    }));
    setCurrentStep('price');
  };

  const handlePricingConfirm = (data: PricingResult) => {
    setBookingData(prev => ({ ...prev, pricingResult: data }));
    setCurrentStep('deposit');
  };

  const handleDepositConfirm = (data: DepositResult) => {
    setBookingData(prev => ({ ...prev, depositResult: data }));
    setCurrentStep('confirm');
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'unit':
        setCurrentStep('customer');
        break;
      case 'price':
        setCurrentStep('unit');
        break;
      case 'deposit':
        setCurrentStep('price');
        break;
      case 'confirm':
        setCurrentStep('deposit');
        break;
    }
  };

  const handleFinalSuccess = () => {
      // Keep user on confirm step (which shows success message)
      // Optionally reset form after delay or manual action
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'customer':
        return (
          <CustomerStep 
            onNext={handleCustomerSelect} 
            initialCustomer={bookingData.customer || undefined} 
          />
        );
      case 'unit':
        return (
          <UnitSelectionStep 
            onNext={handleUnitSelect}
            onBack={handleBack}
            initialData={{
              unitType: bookingData.unitType,
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              bookingType: bookingData.bookingType
            }}
          />
        );
      case 'price':
        if (!bookingData.unitType || !bookingData.priceCalculation) return <div>Missing Data</div>;
        return (
          <PricingStep
            unitType={bookingData.unitType}
            calculation={bookingData.priceCalculation}
            initialData={bookingData.pricingResult}
            onNext={handlePricingConfirm}
            onBack={handleBack}
          />
        );
      case 'deposit':
        if (!bookingData.pricingResult) return <div>Missing Data</div>;
        return (
          <DepositStep
            pricingResult={bookingData.pricingResult}
            initialData={bookingData.depositResult}
            onNext={handleDepositConfirm}
            onBack={handleBack}
          />
        );
      case 'confirm':
        return (
            <ConfirmStep 
                data={bookingData}
                onSuccess={handleFinalSuccess}
                onBack={handleBack}
            />
        );
      default:
        return <div>Coming Soon</div>;
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stepper Header - Compact & Elegant */}
      <div className="mb-6 md:mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="overflow-x-auto pb-2 -mb-2 hide-scrollbar">
            <div className="relative flex justify-between items-start px-2 md:px-4 min-w-[400px] md:min-w-0">
            
            {/* Progress Lines Wrapper - Aligned with circle centers */}
            <div className="absolute top-4 left-0 right-0 mx-6 md:mx-8 h-0.5 -z-10">
                {/* Background Line */}
                <div className="absolute inset-0 bg-gray-100" />
                
                {/* Active Progress Line */}
                <div 
                className="absolute top-0 right-0 h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                />
            </div>

            {STEPS.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                const Icon = step.icon;

                return (
                <div key={step.id} className="flex flex-col items-center group cursor-default relative z-10">
                    <div 
                    className={`
                        w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 bg-white
                        ${isActive ? 'border-blue-600 bg-blue-600 text-white shadow-md scale-110' : 
                        isCompleted ? 'border-blue-600 text-blue-600' : 
                        'border-gray-200 text-gray-300'}
                    `}
                    >
                    {isCompleted ? <CheckCircle size={14} /> : <Icon size={14} />}
                    </div>
                    <span className={`mt-3 text-[10px] font-bold transition-colors duration-300 text-center w-16 md:w-20 ${isActive ? 'text-blue-700' : isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>
                    {step.label}
                    </span>
                </div>
                );
            })}
            </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
        <div className="p-6">
          <div className="mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              {STEPS[currentStepIndex].label}
            </h2>
            <p className="text-gray-500 mt-2 text-base">
              {currentStep === 'customer' && 'ابدأ باختيار العميل أو إنشاء ملف جديد للمتابعة'}
              {currentStep === 'unit' && 'حدد نوع الوحدة وتواريخ الإقامة المناسبة'}
              {currentStep === 'price' && 'مراجعة تفاصيل التكلفة وتطبيق الخصومات'}
              {currentStep === 'deposit' && 'تسجيل العربون أو الدفعة المقدمة لتأكيد الحجز'}
              {currentStep === 'confirm' && 'مراجعة نهائية وإصدار وثائق الحجز'}
            </p>
          </div>

          {renderStep()}
        </div>
      </div>
    </div>
  );
};
