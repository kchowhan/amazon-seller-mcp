// src/operations/merchantFulfillment.ts
// Merchant Fulfillment API v0
// Model: merchantFulfillmentV0.json
// Rate limits from model descriptions:
//   getEligibleShipmentServices: 1/s  burst 1
//   createShipment:              1/s  burst 1
import type { SpApiClient } from "../client";

const GET_ELIGIBLE_RATE = { rate: 1, burst: 1 };
const CREATE_SHIPMENT_RATE = { rate: 1, burst: 1 };

// -- Shared types -----------------------------------------------------------

export interface Address {
  Name: string;
  AddressLine1: string;
  AddressLine2?: string;
  AddressLine3?: string;
  DistrictOrCounty?: string;
  City: string;
  CountryCode: string;
  Email: string;
  Phone: string;
  PostalCode: string;
}

export interface ItemList {
  OrderItemId: string;
  Quantity: number;
}

export interface PackageDimensions {
  Length?: number;
  Width?: number;
  Height?: number;
  Unit?: string;
  PredefinedPackageDimensions?: string;
}

export interface Weight {
  Value: number;
  Unit: string;
}

export interface ShippingServiceOptions {
  DeliveryExperience: string;
  CarrierWillPickUp: boolean;
  CarrierWillPickUpOption?: string;
  DeclaredValue?: { CurrencyCode: string; Amount: string };
  LabelFormat?: string;
}

export interface ShipmentRequestDetails {
  AmazonOrderId: string;
  SellerOrderId?: string;
  ItemList: ItemList[];
  ShipFromAddress: Address;
  PackageDimensions: PackageDimensions;
  Weight: Weight;
  MustArriveByDate?: string;
  ShipDate?: string;
  ShippingServiceOptions: ShippingServiceOptions;
  LabelCustomization?: { CustomTextForLabel?: string; StandardIdForLabel?: string };
}

// -- getEligibleShipmentServices --------------------------------------------

export interface GetEligibleShipmentServicesParams {
  ShipmentRequestDetails: ShipmentRequestDetails;
  ShippingOfferingFilter?: unknown;
}

export interface EligibleShipmentServicesResult {
  payload?: {
    ShippingServiceList?: unknown[];
    RejectedShippingServiceList?: unknown[];
    TemporarilyUnavailableCarrierList?: unknown[];
    TermsAndConditionsNotAcceptedCarrierList?: unknown[];
  };
}

/**
 * POST /mfn/v0/eligibleShippingServices
 * Returns eligible shipping services for a shipment request.
 * Not a restricted operation (per SP-API Tokens use-case guide; no PII returned).
 */
export async function getEligibleShipmentServices(
  client: SpApiClient,
  params: GetEligibleShipmentServicesParams,
): Promise<EligibleShipmentServicesResult> {
  return client.request<EligibleShipmentServicesResult>({
    operation: "getEligibleShipmentServices",
    method: "POST",
    path: "/mfn/v0/eligibleShippingServices",
    body: {
      ShipmentRequestDetails: params.ShipmentRequestDetails,
      ...(params.ShippingOfferingFilter !== undefined
        ? { ShippingOfferingFilter: params.ShippingOfferingFilter }
        : {}),
    },
    rateLimit: GET_ELIGIBLE_RATE,
  });
}

// -- createShipment ---------------------------------------------------------

export interface CreateShipmentParams {
  ShipmentRequestDetails: ShipmentRequestDetails;
  ShippingServiceId: string;
  ShippingServiceOfferId?: string;
  HazmatType?: string;
  LabelFormatOption?: unknown;
  ShipmentLevelSellerInputsList?: unknown[];
}

export interface CreateShipmentResult {
  payload?: unknown;
}

/**
 * POST /mfn/v0/shipments
 * Creates a shipment for an order. Restricted operation (per SP-API Tokens use-case guide)
 * because the response contains the buyer's shipping address (PII).
 * dataElements: ["shippingAddress"]
 */
export async function createShipment(
  client: SpApiClient,
  params: CreateShipmentParams,
): Promise<CreateShipmentResult> {
  return client.request<CreateShipmentResult>({
    operation: "createShipment",
    method: "POST",
    path: "/mfn/v0/shipments",
    body: {
      ShipmentRequestDetails: params.ShipmentRequestDetails,
      ShippingServiceId: params.ShippingServiceId,
      ...(params.ShippingServiceOfferId !== undefined
        ? { ShippingServiceOfferId: params.ShippingServiceOfferId }
        : {}),
      ...(params.HazmatType !== undefined ? { HazmatType: params.HazmatType } : {}),
      ...(params.LabelFormatOption !== undefined
        ? { LabelFormatOption: params.LabelFormatOption }
        : {}),
      ...(params.ShipmentLevelSellerInputsList !== undefined
        ? { ShipmentLevelSellerInputsList: params.ShipmentLevelSellerInputsList }
        : {}),
    },
    rateLimit: CREATE_SHIPMENT_RATE,
    restrictedResources: [
      {
        method: "POST",
        path: "/mfn/v0/shipments",
        dataElements: ["shippingAddress"],
      },
    ],
  });
}
