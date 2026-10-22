import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";

import type { LocalizedText } from "#/db/schema";

export function localized(text: LocalizedText): string {
  return text[getLocale()] || text.en;
}

const PROPERTY_TYPE_LABELS: Record<string, () => string> = {
  apartment: m.type_apartment,
  house: m.type_house,
  villa: m.type_villa,
  studio: m.type_studio,
  commercial: m.type_commercial,
  parking: m.type_parking,
  land: m.type_land,
};

export function propertyTypeLabel(type: string): string {
  return PROPERTY_TYPE_LABELS[type]?.() ?? type;
}

const CATEGORY_LABELS: Record<string, () => string> = {
  rent: m.category_rent,
  holiday_rent: m.category_holiday_rent,
  parking_rent: m.category_parking_rent,
  insurance_claim: m.category_insurance_claim,
  other_income: m.category_other_income,
  community_fees: m.category_community_fees,
  ibi_tax: m.category_ibi_tax,
  insurance: m.category_insurance,
  maintenance: m.category_maintenance,
  repairs: m.category_repairs,
  utilities: m.category_utilities,
  management: m.category_management,
  taxes: m.category_taxes,
  legal: m.category_legal,
  furniture: m.category_furniture,
  other_expense: m.category_other_expense,
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category]?.() ?? category;
}

const FREQUENCY_LABELS: Record<string, () => string> = {
  monthly: m.frequency_monthly,
  quarterly: m.frequency_quarterly,
  yearly: m.frequency_yearly,
};

export function frequencyLabel(frequency: string): string {
  return FREQUENCY_LABELS[frequency]?.() ?? frequency;
}

const TAG_LABELS: Record<string, () => string> = {
  renovation: m.tag_renovation,
  long_term: m.tag_long_term,
  turn_key: m.tag_turn_key,
  holiday_rental: m.tag_holiday_rental,
  high_yield: m.tag_high_yield,
  commercial: m.tag_commercial,
  tenant_in_place: m.tag_tenant_in_place,
  sea_view: m.tag_sea_view,
  mixed_use: m.tag_mixed_use,
  value_add: m.tag_value_add,
  co_living: m.tag_co_living,
  low_risk: m.tag_low_risk,
};

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag]?.() ?? tag;
}
