/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Seed script – run with:  npm run seed
 * Populates: owners, agents (with agent_profiles), and houses across Tanzania.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  AgentProfile,
  AgentVerificationStatus,
} from '../agents/entities/agent-profile.entity';
import {
  House,
  HouseType,
  HouseStatus,
  FurnishingStatus,
} from '../houses/entities/house.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { ViewingRequest } from '../viewings/entities/viewing-request.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExchangeRequest } from '../exchanges/entities/exchange-request.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';

// ─── DB connection ────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'nikupangishe_pass',
  database: process.env.DB_NAME || 'nikupangishe',
  entities: [
    User,
    AgentProfile,
    TenantProfile,
    House,
    HouseAgent,
    Tenancy,
    ViewingRequest,
    Notification,
    ExchangeRequest,
    ChatMessage,
  ],
  synchronize: false,
  ssl: false,
});

// ─── Seed data ────────────────────────────────────────────────────────────────
const OWNERS = [
  {
    firstName: 'Amina',
    lastName: 'Hassan',
    email: 'amina.hassan@nikupangishe.co.tz',
    phone: '+255712001001',
    password: 'Owner@1234',
  },
  {
    firstName: 'James',
    lastName: 'Mwangi',
    email: 'james.mwangi@nikupangishe.co.tz',
    phone: '+255754002002',
    password: 'Owner@1234',
  },
  {
    firstName: 'Fatuma',
    lastName: 'Said',
    email: 'fatuma.said@nikupangishe.co.tz',
    phone: '+255768003003',
    password: 'Owner@1234',
  },
  {
    firstName: 'Rashid',
    lastName: 'Ally',
    email: 'rashid.ally@nikupangishe.co.tz',
    phone: '+255713004004',
    password: 'Owner@1234',
  },
  {
    firstName: 'Grace',
    lastName: 'Omondi',
    email: 'grace.omondi@nikupangishe.co.tz',
    phone: '+255755005005',
    password: 'Owner@1234',
  },
  {
    firstName: 'Hamisi',
    lastName: 'Mwamba',
    email: 'hamisi.mwamba@nikupangishe.co.tz',
    phone: '+255769006006',
    password: 'Owner@1234',
  },
  {
    firstName: 'Lilian',
    lastName: 'Mwita',
    email: 'lilian.mwita@nikupangishe.co.tz',
    phone: '+255714007007',
    password: 'Owner@1234',
  },
  {
    firstName: 'Omar',
    lastName: 'Shariff',
    email: 'omar.shariff@nikupangishe.co.tz',
    phone: '+255756008008',
    password: 'Owner@1234',
  },
];

const AGENTS = [
  {
    firstName: 'Baraka',
    lastName: 'Kimani',
    email: 'baraka.kimani@nikupangishe.co.tz',
    phone: '+255786100101',
    password: 'Agent@1234',
    agencyName: 'Kimani Properties Ltd',
    bio: 'Experienced Dar es Salaam property agent with 8 years helping clients find the perfect home.',
    licenseNumber: 'TRE-2020-00041',
  },
  {
    firstName: 'Salma',
    lastName: 'Juma',
    email: 'salma.juma@nikupangishe.co.tz',
    phone: '+255777200202',
    password: 'Agent@1234',
    agencyName: 'Salma Real Estate Agency',
    bio: 'Licensed real estate agent operating across Kinondoni and Mikocheni since 2018.',
    licenseNumber: 'TRE-2018-00089',
  },
  {
    firstName: 'Victor',
    lastName: 'Ndiaye',
    email: 'victor.ndiaye@nikupangishe.co.tz',
    phone: '+255788300303',
    password: 'Agent@1234',
    agencyName: 'Ndiaye Realty Tanzania',
    bio: 'Zanzibar-based agent specialising in Stone Town heritage properties and beach villas.',
    licenseNumber: 'TRE-2019-00217',
  },
  {
    firstName: 'Asha',
    lastName: 'Mramba',
    email: 'asha.mramba@nikupangishe.co.tz',
    phone: '+255762400404',
    password: 'Agent@1234',
    agencyName: 'Mramba & Associates',
    bio: 'Northern zone specialist covering Arusha, Moshi and Kilimanjaro region properties.',
    licenseNumber: 'TRE-2021-00334',
  },
  {
    firstName: 'Dennis',
    lastName: 'Ochieng',
    email: 'dennis.ochieng@nikupangishe.co.tz',
    phone: '+255799500505',
    password: 'Agent@1234',
    agencyName: 'Lake Victoria Homes',
    bio: 'Leading property agent in Mwanza with a portfolio spanning lakeside and city-centre listings.',
    licenseNumber: 'TRE-2017-00158',
  },
];

const HOUSES_TEMPLATE = [
  // ── DAR ES SALAAM ─────────────────────────────────────────────────────────
  {
    title: 'Modern 3-Bedroom Apartment in Masaki',
    description:
      'Bright, fully furnished apartment on the 4th floor of a secure compound in the sought-after Masaki peninsula. Walking distance to the beach, restaurants, and embassies. Fitted kitchen, large balcony with ocean views.',
    houseType: HouseType.APARTMENT,
    address: 'Plot 45, Toure Drive, Masaki',
    area: 'Masaki',
    city: 'Dar es Salaam',
    latitude: -6.7637,
    longitude: 39.2795,
    rentAmount: 2800000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 145,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: [
      'Swimming Pool',
      'Gym',
      'Parking',
      'Backup Generator',
      'Air Conditioning',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    ],
    ownerIndex: 0,
    agentIndex: 0,
  },
  {
    title: 'Cosy 2-Bedroom House in Mikocheni',
    description:
      'Well-maintained standalone house in a quiet, gated street in Mikocheni B. Features a private compound, garden, and a separate servant quarter. Close to Shoppers Plaza and Sea Cliff Hotel.',
    houseType: HouseType.HOUSE,
    address: 'Mikocheni B, Street 17 No. 12',
    area: 'Mikocheni',
    city: 'Dar es Salaam',
    latitude: -6.7502,
    longitude: 39.2608,
    rentAmount: 1500000,
    bedrooms: 2,
    bathrooms: 2,
    squareMeters: 110,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: ['Private Garden', 'Parking', 'Security Fence', 'Water Tank'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 0,
    agentIndex: 1,
  },
  {
    title: 'Executive Studio in Oyster Bay',
    description:
      'Elegant studio apartment in the prestigious Oyster Bay neighbourhood, ideal for a professional. Fully fitted kitchenette, high-speed fibre internet, 24/7 security and concierge service.',
    houseType: HouseType.STUDIO,
    address: 'Haile Selassie Road, Oyster Bay',
    area: 'Oyster Bay',
    city: 'Dar es Salaam',
    latitude: -6.7785,
    longitude: 39.2864,
    rentAmount: 950000,
    bedrooms: 0,
    bathrooms: 1,
    squareMeters: 48,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: [
      'Fibre Internet',
      'Air Conditioning',
      'Covered Parking',
      'Backup Generator',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    ],
    ownerIndex: 1,
    agentIndex: 0,
  },
  {
    title: 'Spacious 4-Bedroom Villa in Mbezi Beach',
    description:
      "Luxurious villa set on a 1/4 acre plot just 200 m from Mbezi Beach. Private pool, landscaped garden, large open-plan living area and separate maid's quarters. Ideal for families or corporate let.",
    houseType: HouseType.VILLA,
    address: 'Mbezi Beach, Plot 7, Off Old Bagamoyo Road',
    area: 'Mbezi Beach',
    city: 'Dar es Salaam',
    latitude: -6.7068,
    longitude: 39.2203,
    rentAmount: 5500000,
    bedrooms: 4,
    bathrooms: 3,
    squareMeters: 320,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: true,
    amenities: [
      'Private Pool',
      'BBQ Area',
      'Double Garage',
      'Borehole',
      'Solar Backup',
      'Home Theatre',
    ],
    depositMonths: 3,
    photos: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    ],
    ownerIndex: 1,
    agentIndex: null,
  },
  {
    title: 'Affordable Single Room in Kinondoni',
    description:
      'Clean, secure single room in a well-managed block in Kinondoni. Shared kitchen and bathrooms. Convenient to public transport routes, local markets and Mwenge area.',
    houseType: HouseType.ROOM,
    address: 'Kinondoni, Street 5, Near Mwenge',
    area: 'Kinondoni',
    city: 'Dar es Salaam',
    latitude: -6.7836,
    longitude: 39.2381,
    rentAmount: 150000,
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: 18,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Shared Kitchen', 'Safe Compound'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80',
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
    ],
    ownerIndex: 2,
    agentIndex: null,
  },
  {
    title: '2-Bedroom Apartment in Kariakoo',
    description:
      'Well-located apartment on 3rd floor in a central Kariakoo building, minutes from the central market and bus terminus. Great for business travellers or small families.',
    houseType: HouseType.APARTMENT,
    address: 'Msimbazi Street, Kariakoo, No. 99',
    area: 'Kariakoo',
    city: 'Dar es Salaam',
    latitude: -6.8219,
    longitude: 39.2748,
    rentAmount: 600000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 75,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Rooftop Access', 'Central Location'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa8ba58?w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    ownerIndex: 0,
    agentIndex: 0,
  },
  {
    title: 'Luxury 5-Bedroom Standalone in Msasani',
    description:
      'Grand family home in an exclusive Msasani compound. Expansive living spaces, American kitchen, wine cellar, covered car port for 3 vehicles and beautifully landscaped grounds with a private pool.',
    houseType: HouseType.STANDALONE,
    address: 'Msasani Peninsula, Plot 102',
    area: 'Msasani',
    city: 'Dar es Salaam',
    latitude: -6.7559,
    longitude: 39.2853,
    rentAmount: 8000000,
    bedrooms: 5,
    bathrooms: 4,
    squareMeters: 480,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: [
      'Private Pool',
      'Home Office',
      'Wine Cellar',
      'Solar System',
      'Gym',
      'Jacuzzi',
    ],
    depositMonths: 3,
    photos: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    ],
    ownerIndex: 1,
    agentIndex: 1,
  },
  {
    title: 'Budget Room Near Ubungo Bus Terminal',
    description:
      'Affordable single room in a safe multi-tenant house near Ubungo Interchange. Ideal for a student or commuter. Water and electricity included in rent.',
    houseType: HouseType.ROOM,
    address: 'Ubungo, Street 12, House 4',
    area: 'Ubungo',
    city: 'Dar es Salaam',
    latitude: -6.7983,
    longitude: 39.2235,
    rentAmount: 100000,
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: 15,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Water Included', 'Electricity Included', 'Near Bus Stop'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80',
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80',
    ],
    ownerIndex: 3,
    agentIndex: null,
  },
  {
    title: '3-Bedroom Semi-Furnished Apartment in Sinza',
    description:
      'Spacious apartment in a popular residential area. Close to schools, shops and public transport. Reliable DAWASCO water and TANESCO supply. Tiled floors throughout.',
    houseType: HouseType.APARTMENT,
    address: 'Sinza C, Street 9 No. 28',
    area: 'Sinza',
    city: 'Dar es Salaam',
    latitude: -6.7901,
    longitude: 39.2467,
    rentAmount: 750000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 105,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: ['Parking', 'Security Guard', 'Water Tank'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa8ba58?w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    ownerIndex: 3,
    agentIndex: 1,
  },
  {
    title: 'Beachfront 2-Bedroom Apartment in Kunduchi',
    description:
      'Stunning ocean-view apartment in Kunduchi, directly opposite the beach. Enjoy sunrise from your private terrace. Weekly water delivery included. Ideal for expats or remote workers.',
    houseType: HouseType.APARTMENT,
    address: 'Beach Road, Kunduchi, Block A',
    area: 'Kunduchi',
    city: 'Dar es Salaam',
    latitude: -6.6614,
    longitude: 39.2278,
    rentAmount: 2200000,
    bedrooms: 2,
    bathrooms: 2,
    squareMeters: 115,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: [
      'Ocean View',
      'Private Terrace',
      'Beach Access',
      'Air Conditioning',
      'Parking',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      'https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=800&q=80',
    ],
    ownerIndex: 4,
    agentIndex: 0,
  },
  {
    title: 'Family Home — 4 Bedrooms in Tegeta',
    description:
      'Generous family house in the growing Tegeta suburb with large compound and two covered parking bays. Close to Tegeta market and new road infrastructure.',
    houseType: HouseType.HOUSE,
    address: 'Tegeta, Block N, Plot 18',
    area: 'Tegeta',
    city: 'Dar es Salaam',
    latitude: -6.6887,
    longitude: 39.2106,
    rentAmount: 1100000,
    bedrooms: 4,
    bathrooms: 2,
    squareMeters: 200,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: [
      'Large Compound',
      'Double Parking',
      'Water Tank',
      'Servant Quarter',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 4,
    agentIndex: 2,
  },
  {
    title: 'Furnished Studio in Upanga',
    description:
      'Compact but well-designed studio in Upanga West, heart of the diplomatic quarter. Fully equipped kitchen, fast Wi-Fi, air conditioning. Short-term lease considered.',
    houseType: HouseType.STUDIO,
    address: 'Upanga West, Garden Ave No. 7',
    area: 'Upanga',
    city: 'Dar es Salaam',
    latitude: -6.8092,
    longitude: 39.2889,
    rentAmount: 700000,
    bedrooms: 0,
    bathrooms: 1,
    squareMeters: 38,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: [
      'Air Conditioning',
      'Wi-Fi',
      'Fitted Kitchen',
      'Street Parking',
    ],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    ],
    ownerIndex: 5,
    agentIndex: 1,
  },
  {
    title: '1-Bedroom Apartment Near Mlimani City Mall',
    description:
      'Neat, affordable apartment close to the University of Dar es Salaam and Mlimani City. Perfect for students or young professionals. Secure compound with CCTV.',
    houseType: HouseType.APARTMENT,
    address: 'Mlimani Area, University Road No. 44',
    area: 'Mlimani',
    city: 'Dar es Salaam',
    latitude: -6.7706,
    longitude: 39.2241,
    rentAmount: 400000,
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: 52,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['CCTV', 'Parking', 'Near University', 'Near Mall'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa8ba58?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    ownerIndex: 5,
    agentIndex: null,
  },
  // ── ARUSHA ────────────────────────────────────────────────────────────────
  {
    title: '3-Bedroom Townhouse in Arusha GFC',
    description:
      'Modern townhouse in the GFC neighbourhood of Arusha, close to international schools and AICC. Gated compound with two other units, private garden, fitted kitchen and reliable TANESCO connection.',
    houseType: HouseType.TOWNHOUSE,
    address: 'GFC, Off Serengeti Road, Arusha',
    area: 'GFC',
    city: 'Arusha',
    latitude: -3.3616,
    longitude: 36.6937,
    rentAmount: 1800000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 160,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: [
      'Private Garden',
      'Parking x2',
      'Solar Water Heater',
      'Fibre-Ready',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    ],
    ownerIndex: 2,
    agentIndex: 3,
  },
  {
    title: 'Cosy 2-Bedroom Cottage in Arusha Themi',
    description:
      'Charming stone-built cottage in a leafy compound in Themi area. Close to Arusha town centre, Nakumatt and offices. Enjoys cool highland climate — no AC needed.',
    houseType: HouseType.HOUSE,
    address: 'Themi Ward, Street 4, Plot 9',
    area: 'Themi',
    city: 'Arusha',
    latitude: -3.3731,
    longitude: 36.7071,
    rentAmount: 900000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 88,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: ['Private Garden', 'Cool Climate', 'Parking', 'Great Views'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    ],
    ownerIndex: 2,
    agentIndex: null,
  },
  {
    title: 'Executive 4-Bedroom House in Arusha Njiro',
    description:
      'Well-finished executive home in the upmarket Njiro estate. Open-plan sitting room, American-style kitchen, en-suite master bedroom and solar water heating. Ideal for an expat or senior officer.',
    houseType: HouseType.HOUSE,
    address: 'Njiro Estate, Road 3, Plot 55',
    area: 'Njiro',
    city: 'Arusha',
    latitude: -3.3928,
    longitude: 36.7231,
    rentAmount: 2500000,
    bedrooms: 4,
    bathrooms: 3,
    squareMeters: 220,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: [
      'Solar Water',
      'CCTV',
      'Double Garage',
      'En-suite Master',
      'Fibre Internet',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 6,
    agentIndex: 3,
  },
  {
    title: 'Studio Apartment Near Arusha Bus Stand',
    description:
      'Compact, no-frills studio above a commercial building close to the Arusha central bus stand and market. Ideal for a traveller, student or small business operator.',
    houseType: HouseType.STUDIO,
    address: 'AICC Road, Old Town, 2nd Floor',
    area: 'Arusha CBD',
    city: 'Arusha',
    latitude: -3.3665,
    longitude: 36.6818,
    rentAmount: 250000,
    bedrooms: 0,
    bathrooms: 1,
    squareMeters: 30,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Central Location', 'Near Markets'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
    ],
    ownerIndex: 6,
    agentIndex: null,
  },
  // ── ZANZIBAR ──────────────────────────────────────────────────────────────
  {
    title: 'Heritage 2-Bedroom Apartment in Stone Town',
    description:
      'Beautiful restored Swahili-style apartment in the UNESCO World Heritage Stone Town. Carved wooden doorways, traditional décor, courtyard views. Walking distance to beaches, restaurants and the Palace Museum.',
    houseType: HouseType.APARTMENT,
    address: 'Shangani Street, Stone Town, Zanzibar',
    area: 'Stone Town',
    city: 'Zanzibar',
    latitude: -6.1622,
    longitude: 39.1894,
    rentAmount: 1600000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 90,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: [
      'Heritage Architecture',
      'Rooftop Terrace',
      'Near Beach',
      'Wi-Fi',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1602602075359-5a6fcafe4e30?w=800&q=80',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80',
    ],
    ownerIndex: 7,
    agentIndex: 2,
  },
  {
    title: 'Beachfront Villa in Nungwi',
    description:
      'Stunning 3-bedroom villa with direct access to the white sands of Nungwi beach on the northern tip of Zanzibar Island. Infinity pool, tropical garden and a full-time housekeeper.',
    houseType: HouseType.VILLA,
    address: 'Nungwi Beach Road, Plot 3',
    area: 'Nungwi',
    city: 'Zanzibar',
    latitude: -5.727,
    longitude: 39.2977,
    rentAmount: 6500000,
    bedrooms: 3,
    bathrooms: 3,
    squareMeters: 250,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: [
      'Infinity Pool',
      'Beach Access',
      'Housekeeper',
      'Tropical Garden',
      'Solar Power',
    ],
    depositMonths: 3,
    photos: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    ],
    ownerIndex: 7,
    agentIndex: 2,
  },
  {
    title: 'Modern 2-Bedroom Apartment in Kendwa',
    description:
      'Contemporary apartment complex just 300 m from Kendwa beach. Security compound, communal pool and reliable fibre internet. Perfect for remote workers seeking paradise.',
    houseType: HouseType.APARTMENT,
    address: 'Kendwa, North Zanzibar, Unit 5B',
    area: 'Kendwa',
    city: 'Zanzibar',
    latitude: -5.7524,
    longitude: 39.2863,
    rentAmount: 2000000,
    bedrooms: 2,
    bathrooms: 2,
    squareMeters: 100,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: [
      'Communal Pool',
      'Fibre Internet',
      'Near Beach',
      'Air Conditioning',
      'Backup Generator',
    ],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    ownerIndex: 3,
    agentIndex: 2,
  },
  {
    title: 'Affordable Swahili Room in Zanzibar Old Town',
    description:
      'Traditional single room in a family-run Swahili house in Stone Town. Shared courtyard and communal kitchen. Within walking distance of ferry terminal and all amenities.',
    houseType: HouseType.ROOM,
    address: 'Hurumzi Street, Stone Town',
    area: 'Stone Town',
    city: 'Zanzibar',
    latitude: -6.1641,
    longitude: 39.1906,
    rentAmount: 180000,
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: 20,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Shared Courtyard', 'Near Ferry', 'Old Town Charm'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1602602075359-5a6fcafe4e30?w=800&q=80',
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80',
    ],
    ownerIndex: 7,
    agentIndex: null,
  },
  // ── MWANZA ────────────────────────────────────────────────────────────────
  {
    title: 'Lakeside 3-Bedroom House in Mwanza Isamilo',
    description:
      'Peaceful family house in the scenic Isamilo hill area of Mwanza, overlooking Lake Victoria. Large veranda, mature garden and stunning sunset views. Five minutes from Mwanza city centre.',
    houseType: HouseType.HOUSE,
    address: 'Isamilo Hill, Plot 22, Mwanza',
    area: 'Isamilo',
    city: 'Mwanza',
    latitude: -2.5165,
    longitude: 32.8935,
    rentAmount: 1200000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 140,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: true,
    amenities: ['Lake View', 'Large Veranda', 'Parking', 'Mature Garden'],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1504548840739-580b10ae7715?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    ],
    ownerIndex: 4,
    agentIndex: 4,
  },
  {
    title: '2-Bedroom Apartment in Mwanza City Centre',
    description:
      'Practical city-centre apartment above a commercial block in Mwanza CBD. Close to Mwanza Regional Hospital, ferry terminal and all amenities.',
    houseType: HouseType.APARTMENT,
    address: 'Station Road, Mwanza CBD, 3rd Floor',
    area: 'Mwanza CBD',
    city: 'Mwanza',
    latitude: -2.516,
    longitude: 32.8959,
    rentAmount: 550000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 70,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Central Location', 'Near Ferry', 'Near Hospital'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa8ba58?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    ownerIndex: 5,
    agentIndex: 4,
  },
  {
    title: 'Spacious 4-Bedroom Villa in Mwanza Pasiansi',
    description:
      'Impressive villa in the prestigious Pasiansi area with panoramic views of Lake Victoria. Solar system, borehole, double garage and a beautiful veranda overlooking the lake.',
    houseType: HouseType.VILLA,
    address: 'Pasiansi, Off Nyerere Road, Mwanza',
    area: 'Pasiansi',
    city: 'Mwanza',
    latitude: -2.4811,
    longitude: 32.8763,
    rentAmount: 4000000,
    bedrooms: 4,
    bathrooms: 3,
    squareMeters: 280,
    furnishingStatus: FurnishingStatus.FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: [
      'Lake View',
      'Solar System',
      'Borehole',
      'Double Garage',
      'Large Veranda',
    ],
    depositMonths: 3,
    photos: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
      'https://images.unsplash.com/photo-1504548840739-580b10ae7715?w=800&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    ],
    ownerIndex: 6,
    agentIndex: 4,
  },
  // ── DODOMA ────────────────────────────────────────────────────────────────
  {
    title: '3-Bedroom Government Quarter in Dodoma Makole',
    description:
      'Well-built house in the Makole residential area close to Parliament, ministries and government offices. Tarmac access, reliable utilities, good security neighbourhood.',
    houseType: HouseType.HOUSE,
    address: 'Makole Ward, Street 6 No. 14, Dodoma',
    area: 'Makole',
    city: 'Dodoma',
    latitude: -6.1723,
    longitude: 35.7327,
    rentAmount: 900000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 130,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: true,
    petFriendly: false,
    isOpenToExchange: false,
    amenities: ['Near Parliament', 'Private Compound', 'Parking'],
    depositMonths: 2,
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 3,
    agentIndex: null,
  },
  {
    title: 'Modern 2-Bedroom Apartment in Dodoma Chamwino',
    description:
      "Brand-new apartment in Chamwino, Dodoma's newest residential district. Tiled throughout, fitted kitchen, 24/7 security. Quick access to the new business district and government buildings.",
    houseType: HouseType.APARTMENT,
    address: 'Chamwino Road, Block 4B, Dodoma',
    area: 'Chamwino',
    city: 'Dodoma',
    latitude: -6.1527,
    longitude: 35.7519,
    rentAmount: 650000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 80,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: ['CCTV', 'Security Guard', 'Parking', 'Fibre-Ready'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa8ba58?w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    ],
    ownerIndex: 6,
    agentIndex: null,
  },
  // ── MOSHI ─────────────────────────────────────────────────────────────────
  {
    title: '2-Bedroom Cottage with Kilimanjaro View in Moshi',
    description:
      'Idyllic stone cottage nestled in coffee farm surroundings in the Shantytown area of Moshi. Wake up to unobstructed views of Mount Kilimanjaro every morning. Cool climate year-round.',
    houseType: HouseType.HOUSE,
    address: 'Shantytown Area, Moshi Rural, Plot 8',
    area: 'Shantytown',
    city: 'Moshi',
    latitude: -3.355,
    longitude: 37.3389,
    rentAmount: 800000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 90,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: true,
    amenities: [
      'Kilimanjaro View',
      'Coffee Farm Surroundings',
      'Cool Climate',
      'Private Garden',
    ],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 7,
    agentIndex: 3,
  },
  {
    title: '3-Bedroom Family House in Moshi Town Centre',
    description:
      'Solid house in central Moshi town within walking distance of the main market, bank and transport links. Walled compound, two parking spaces, and a small fruit garden.',
    houseType: HouseType.HOUSE,
    address: 'Rindi Lane, Moshi Town No. 33',
    area: 'Moshi Town',
    city: 'Moshi',
    latitude: -3.3497,
    longitude: 37.3395,
    rentAmount: 700000,
    bedrooms: 3,
    bathrooms: 2,
    squareMeters: 120,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: false,
    hasGarden: true,
    petFriendly: true,
    isOpenToExchange: false,
    amenities: [
      'Walled Compound',
      'Parking x2',
      'Fruit Garden',
      'Central Location',
    ],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
    ],
    ownerIndex: 4,
    agentIndex: 3,
  },
  // ── TANGA ─────────────────────────────────────────────────────────────────
  {
    title: 'Ocean-View 2-Bedroom Apartment in Tanga Ras Kazone',
    description:
      'Upper-floor apartment in the historic Ras Kazone area of Tanga with sweeping views of the Indian Ocean. Walking distance to the beach, port and city centre services.',
    houseType: HouseType.APARTMENT,
    address: 'Ras Kazone, Tanga Waterfront No. 7',
    area: 'Ras Kazone',
    city: 'Tanga',
    latitude: -5.0668,
    longitude: 39.1003,
    rentAmount: 750000,
    bedrooms: 2,
    bathrooms: 1,
    squareMeters: 85,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    hasWater: true,
    hasElectricity: true,
    hasInternet: false,
    hasCCTV: false,
    hasSecurityGuard: true,
    hasGarden: false,
    petFriendly: false,
    isOpenToExchange: true,
    amenities: ['Ocean View', 'Near Beach', 'Near Port', 'Security Guard'],
    depositMonths: 1,
    photos: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    ],
    ownerIndex: 5,
    agentIndex: null,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function findOrCreateUser(
  repo: ReturnType<DataSource['getRepository']>,
  data: (typeof OWNERS)[0] & { role: UserRole },
): Promise<User> {
  const existing = (await (repo as any).findOne({
    where: { email: data.email },
  })) as User | null;
  if (existing) {
    console.log(`  ↩  User already exists: ${data.email}`);
    return existing;
  }
  const hashed = await bcrypt.hash(data.password, 10);
  const user = (repo as any).create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    password: hashed,
    role: data.role,
    status: UserStatus.ACTIVE,
    isEmailVerified: true,
    isPhoneVerified: true,
  });
  return (repo as any).save(user) as Promise<User>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Connecting to database…');
  await AppDataSource.initialize();
  console.log('✅  Connected.\n');

  const userRepo = AppDataSource.getRepository(User);
  const agentProfileRepo = AppDataSource.getRepository(AgentProfile);
  const houseRepo = AppDataSource.getRepository(House);
  const houseAgentRepo = AppDataSource.getRepository(HouseAgent);

  // 1. Create owners
  console.log('👤  Seeding owners…');
  const owners: User[] = [];
  for (const o of OWNERS) {
    const u = await findOrCreateUser(userRepo, { ...o, role: UserRole.OWNER });
    owners.push(u);
    console.log(`  ✓  Owner: ${u.firstName} ${u.lastName} (${u.email})`);
  }

  // 2. Create agents + agent profiles
  console.log('\n🏢  Seeding agents…');
  const agents: User[] = [];
  const agentProfiles: AgentProfile[] = [];
  for (const a of AGENTS) {
    const u = await findOrCreateUser(userRepo, { ...a, role: UserRole.AGENT });
    agents.push(u);

    let profile = await agentProfileRepo.findOne({ where: { userId: u.id } });
    if (!profile) {
      profile = agentProfileRepo.create({
        userId: u.id,
        agencyName: a.agencyName,
        bio: a.bio,
        licenseNumber: a.licenseNumber,
        verificationStatus: AgentVerificationStatus.VERIFIED,
        commissionRate: 5,
      });
      profile = await agentProfileRepo.save(profile);
    }
    agentProfiles.push(profile);
    console.log(`  ✓  Agent: ${u.firstName} ${u.lastName} (${u.email})`);
  }

  // 3. Create houses
  console.log('\n🏠  Seeding houses…');
  for (const tmpl of HOUSES_TEMPLATE) {
    const owner = owners[tmpl.ownerIndex];

    const existingHouse = await houseRepo.findOne({
      where: { title: tmpl.title, ownerId: owner.id },
    });
    if (existingHouse) {
      // Back-fill photos if the house was seeded without them
      if (
        (!existingHouse.photos || existingHouse.photos.length === 0) &&
        tmpl.photos &&
        tmpl.photos.length > 0
      ) {
        await houseRepo.update(existingHouse.id, { photos: tmpl.photos });
        console.log(
          `  📸  Updated photos for: "${tmpl.title}"`,
        );
      } else {
        console.log(`  ↩  House already exists: "${tmpl.title}"`);
      }
      continue;
    }

    const house = houseRepo.create({
      ownerId: owner.id,
      title: tmpl.title,
      description: tmpl.description,
      houseType: tmpl.houseType,
      status: HouseStatus.ACTIVE,
      address: tmpl.address,
      area: tmpl.area,
      city: tmpl.city,
      latitude: tmpl.latitude,
      longitude: tmpl.longitude,
      rentAmount: tmpl.rentAmount,
      currency: 'TZS',
      depositMonths: tmpl.depositMonths,
      bedrooms: tmpl.bedrooms,
      bathrooms: tmpl.bathrooms,
      squareMeters: tmpl.squareMeters,
      furnishingStatus: tmpl.furnishingStatus,
      hasWater: tmpl.hasWater,
      hasElectricity: tmpl.hasElectricity,
      hasInternet: tmpl.hasInternet,
      hasCCTV: tmpl.hasCCTV,
      hasSecurityGuard: tmpl.hasSecurityGuard,
      hasGarden: tmpl.hasGarden,
      petFriendly: tmpl.petFriendly,
      isOpenToExchange: tmpl.isOpenToExchange,
      amenities: tmpl.amenities,
      photos: tmpl.photos ?? [],
    });

    const savedHouse = await houseRepo.save(house);
    console.log(
      `  ✓  House: "${savedHouse.title}" [${savedHouse.city}] – owner: ${owner.firstName}`,
    );

    // Assign agent if specified
    if (tmpl.agentIndex !== null) {
      const agentProfile = agentProfiles[tmpl.agentIndex];
      const alreadyAssigned = await houseAgentRepo.findOne({
        where: { houseId: savedHouse.id, agentId: agentProfile.id },
      });
      if (!alreadyAssigned) {
        const ha = houseAgentRepo.create({
          houseId: savedHouse.id,
          agentId: agentProfile.id,
          isPrimary: true,
        });
        await houseAgentRepo.save(ha);
        const agentUser = agents[tmpl.agentIndex];
        console.log(
          `    ↳  Assigned agent: ${agentUser.firstName} ${agentUser.lastName}`,
        );
      }
    }
  }

  console.log('\n🎉  Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('Test credentials (password: Owner@1234 / Agent@1234):');
  for (const o of OWNERS) console.log(`  Owner  ${o.email}`);
  for (const a of AGENTS) console.log(`  Agent  ${a.email}`);
  console.log('─────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
