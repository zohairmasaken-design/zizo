import { parseISO, isWithinInterval, addDays, differenceInCalendarDays, format } from 'date-fns';

export interface PricingRule {
  unit_type_id: string;
  start_date: string;
  end_date: string;
  price: number;
}

export interface UnitType {
  id: string;
  name: string;
  daily_price: number;
  annual_price?: number;
  max_adults: number;
  max_children: number;
  description?: string;
  area?: number;
  hotel?: { name: string };
  features?: string[];
  max_occupancy?: number;
}

export interface PriceCalculation {
  totalPrice: number;
  breakdown: { date: string; price: number; isSeason: boolean }[];
  basePrice: number;
  nights: number;
}

export const calculateStayPrice = (
  unitType: UnitType,
  pricingRules: PricingRule[],
  startDate: Date,
  endDate: Date
): PriceCalculation => {
  let totalPrice = 0;
  const breakdown: { date: string; price: number; isSeason: boolean }[] = [];
  const nights = differenceInCalendarDays(endDate, startDate);

  if (nights <= 0) {
      return { totalPrice: 0, breakdown: [], basePrice: unitType.daily_price, nights: 0 };
  }

  for (let i = 0; i < nights; i++) {
    const currentDate = addDays(startDate, i);
    
    // Find applicable rule
    // Note: In case of overlapping rules, we take the last one (assuming user priority logic) 
    // or the one with highest/lowest price. For now, let's take the first match.
    // Ideally the DB prevents overlaps or we order by created_at.
    const applicableRule = pricingRules.find(rule => 
      rule.unit_type_id === unitType.id &&
      isWithinInterval(currentDate, {
        start: parseISO(rule.start_date),
        end: parseISO(rule.end_date)
      })
    );

    const price = applicableRule ? applicableRule.price : unitType.daily_price;
    
    breakdown.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      price: Number(price),
      isSeason: !!applicableRule
    });
    
    totalPrice += Number(price);
  }

  return {
    totalPrice,
    breakdown,
    basePrice: unitType.daily_price,
    nights
  };
};
