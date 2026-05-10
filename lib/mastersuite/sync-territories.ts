import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

const supabase = getServiceSupabase();

interface MSTerritoryRow {
  TerritoryId: number;
  TerritorySlug: string;
  Broker: string | null;
  IsFranchise: number;
  IsFullTime: number;
  Active: number;
  FullTimeOperator: number;
  ExcludeFromGlobalCalculations: number;
  PrimaryCoach: string | null;
  Nickname: string;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  EmergencyContact: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  StreetAddress: string | null;
  NahCity: string | null;
  NahState: string | null;
  NahZip: string | null;
  RealEstateLicensee: string | null;
  LicenseeBroker: string | null;
  LicenseeBrokerNumber: string | null;
  MarketingName: string | null;
  MarketingPhoneNumber: string | null;
  MarketingReturnAddress: string | null;
  MarketingLeadGenPhoneNumber: string | null;
  MarketingCallCenterForwardingNumber: string | null;
  MarketingEmailAddress: string | null;
  MarketingInstagramProfile: string | null;
  MarketingFacebookPage: string | null;
  DocumentUrlFranchiseAgreement: string | null;
  DocumentUrlCOILiabilityInsurance: string | null;
  DocumentUrlCOIProfessionalLiability: string | null;
  DocumentUrlCOIOther: string | null;
  DocumentUrlBusinessLicense: string | null;
  DocumentUrlRealEstateLicense: string | null;
  DocumentUrlOther: string | null;
  DocumentUrlOther2: string | null;
  ComplianceScore: number | null;
  ComplianceScoreManualDescription: string | null;
  LegalEntityName: string | null;
  InitialApplicationDate: string | null;
  FranchiseAgreementDate: string | null;
  TrainingCompleteDate: string | null;
  FirstPurchaseDate: string | null;
  FranchiseClosedDate: string | null;
  GoHighLevelLocationId: string | null;
  NexaActive: number;
  NexaAccount: string | null;
  Vonage1Active: number;
  Vonage1Account: string | null;
  Vonage2Active: number;
  Vonage2Account: string | null;
  GoogleLicense1Active: number;
  GoogleLicense1Account: string | null;
  GoogleLicense2Active: number;
  GoogleLicense2Account: string | null;
  GoogleLicense3Active: number;
  GoogleLicense3Account: string | null;
  GoogleLicense4Active: number;
  GoogleLicense4Account: string | null;
  Notes: string | null;
}

function toBool(val: number): boolean {
  return val === 1;
}

function toStatus(active: number, closedDate: string | null): string {
  if (closedDate) return "inactive";
  return active === 1 ? "active" : "inactive";
}

function toDate(val: string | null): string | null {
  if (!val) return null;
  // MySQL returns dates as strings — ensure ISO format
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export async function syncTerritories(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];

  const rows = await queryMS<MSTerritoryRow>(`SELECT * FROM Territories ORDER BY TerritorySlug`);

  let synced = 0;

  for (const row of rows) {
    const record = {
      TerritorySlug: row.TerritorySlug,
      Nickname: row.Nickname,
      status: toStatus(row.Active, row.FranchiseClosedDate),
      region: null as string | null,
      FranchiseAgreementDate: toDate(row.FranchiseAgreementDate),
      TerritoryId: row.TerritoryId,
      Broker: row.Broker,
      IsFranchise: toBool(row.IsFranchise),
      IsFullTime: toBool(row.IsFullTime),
      FullTimeOperator: toBool(row.FullTimeOperator),
      ExcludeFromGlobalCalculations: toBool(row.ExcludeFromGlobalCalculations),
      PrimaryCoach: row.PrimaryCoach,
      PersonalName: row.PersonalName,
      Owner2: row.Owner2,
      Owner3: row.Owner3,
      EmergencyContact: row.EmergencyContact,
      FranchiseEmail: row.FranchiseEmail,
      PersonalPhoneNumber: row.PersonalPhoneNumber,
      StreetAddress: row.StreetAddress,
      NahCity: row.NahCity,
      NahState: row.NahState,
      NahZip: row.NahZip,
      RealEstateLicensee: row.RealEstateLicensee,
      LicenseeBroker: row.LicenseeBroker,
      LicenseeBrokerNumber: row.LicenseeBrokerNumber,
      MarketingName: row.MarketingName,
      MarketingPhoneNumber: row.MarketingPhoneNumber,
      MarketingReturnAddress: row.MarketingReturnAddress,
      MarketingLeadGenPhoneNumber: row.MarketingLeadGenPhoneNumber,
      MarketingCallCenterForwardingNumber: row.MarketingCallCenterForwardingNumber,
      MarketingEmailAddress: row.MarketingEmailAddress,
      MarketingInstagramProfile: row.MarketingInstagramProfile,
      MarketingFacebookPage: row.MarketingFacebookPage,
      DocumentUrlFranchiseAgreement: row.DocumentUrlFranchiseAgreement,
      DocumentUrlCOILiabilityInsurance: row.DocumentUrlCOILiabilityInsurance,
      DocumentUrlCOIProfessionalLiability: row.DocumentUrlCOIProfessionalLiability,
      DocumentUrlCOIOther: row.DocumentUrlCOIOther,
      DocumentUrlBusinessLicense: row.DocumentUrlBusinessLicense,
      DocumentUrlRealEstateLicense: row.DocumentUrlRealEstateLicense,
      DocumentUrlOther: row.DocumentUrlOther,
      DocumentUrlOther2: row.DocumentUrlOther2,
      ComplianceScore: row.ComplianceScore,
      ComplianceScoreManualDescription: row.ComplianceScoreManualDescription,
      LegalEntityName: row.LegalEntityName,
      InitialApplicationDate: toDate(row.InitialApplicationDate),
      TrainingCompleteDate: toDate(row.TrainingCompleteDate),
      FirstPurchaseDate: toDate(row.FirstPurchaseDate),
      FranchiseClosedDate: toDate(row.FranchiseClosedDate),
      GoHighLevelLocationId: row.GoHighLevelLocationId,
      NexaActive: toBool(row.NexaActive),
      NexaAccount: row.NexaAccount,
      Vonage1Active: toBool(row.Vonage1Active),
      Vonage1Account: row.Vonage1Account,
      Vonage2Active: toBool(row.Vonage2Active),
      Vonage2Account: row.Vonage2Account,
      GoogleLicense1Active: toBool(row.GoogleLicense1Active),
      GoogleLicense1Account: row.GoogleLicense1Account,
      GoogleLicense2Active: toBool(row.GoogleLicense2Active),
      GoogleLicense2Account: row.GoogleLicense2Account,
      GoogleLicense3Active: toBool(row.GoogleLicense3Active),
      GoogleLicense3Account: row.GoogleLicense3Account,
      GoogleLicense4Active: toBool(row.GoogleLicense4Active),
      GoogleLicense4Account: row.GoogleLicense4Account,
      Notes: row.Notes,
      ms_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("territories").upsert(record, { onConflict: "TerritorySlug" });

    if (error) {
      errors.push(`${row.TerritorySlug}: ${error.message}`);
    } else {
      synced++;
    }
  }

  return { synced, errors };
}
