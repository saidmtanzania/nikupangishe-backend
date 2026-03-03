/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HouseAgent } from './house-agent.entity';
import { Tenancy } from './tenancy.entity';
import { ViewingRequest } from '../../viewings/entities/viewing-request.entity';

export enum HouseStatus {
  DRAFT = 'draft',
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  RENTED = 'rented',
  INACTIVE = 'inactive',
  REJECTED = 'rejected',
}

export enum HouseType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  STUDIO = 'studio',
  ROOM = 'room',
  VILLA = 'villa',
  TOWNHOUSE = 'townhouse',
  // Frontend-compatible types
  STANDALONE = 'standalone',
  SINGLE_ROOM = 'single-room',
  COMMERCIAL = 'commercial',
}

export enum FurnishingStatus {
  FURNISHED = 'furnished',
  SEMI_FURNISHED = 'semi_furnished',
  UNFURNISHED = 'unfurnished',
}

@Entity('houses')
export class House {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.ownedHouses)
  @JoinColumn()
  owner: User;

  @Column()
  ownerId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: HouseType })
  houseType: HouseType;

  @Column({ type: 'enum', enum: HouseStatus, default: HouseStatus.DRAFT })
  status: HouseStatus;

  @Column({
    type: 'enum',
    enum: FurnishingStatus,
    default: FurnishingStatus.UNFURNISHED,
  })
  furnishingStatus: FurnishingStatus;

  // Location
  @Column({ length: 200 })
  address: string;

  @Column({ length: 100 })
  area: string; // Neighborhood/ward

  @Column({ length: 100 })
  city: string;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  // Pricing
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rentAmount: number;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ default: 1 })
  depositMonths: number; // How many months deposit required

  // Features
  @Column({ default: 1 })
  bedrooms: number;

  @Column({ default: 1 })
  bathrooms: number;

  @Column({ nullable: true })
  parkingSpaces: number;

  @Column({ default: false })
  hasWater: boolean;

  @Column({ default: false })
  hasElectricity: boolean;

  @Column({ default: false })
  hasInternet: boolean;

  @Column({ default: false })
  hasGarden: boolean;

  @Column({ default: false })
  hasSecurityGuard: boolean;

  @Column({ default: false })
  hasCCTV: boolean;

  @Column({ default: false })
  petFriendly: boolean;

  // Media
  @Column({ type: 'jsonb', default: [] })
  photos: string[]; // URLs

  @Column({ type: 'jsonb', default: [] })
  videos: string[]; // URLs

  // Verification
  @Column({ nullable: true })
  verificationVideoUrl: string;

  @Column({ nullable: true, type: 'text' })
  verificationNotes: string;

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string;

  @Column({ nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true })
  verifiedBy: string; // Admin user id

  // Availability
  @Column({ nullable: true })
  availableFrom: Date;

  @Column({ nullable: true })
  minimumLeaseDuration: number; // in months

  @Column({ type: 'jsonb', nullable: true })
  amenities: string[];

  @Column({ type: 'jsonb', nullable: true })
  rules: string[]; // No smoking, no parties, etc.

  // Frontend-compatible fields
  @Column({ default: false })
  isUnique: boolean;

  @Column({ default: false })
  isOpenToExchange: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  squareMeters: number; // Frontend uses this as 'area' (number)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => HouseAgent, (ha) => ha.house)
  agentAssignments: HouseAgent[];

  @OneToMany(() => Tenancy, (t) => t.house)
  tenancies: Tenancy[];

  @OneToMany(() => ViewingRequest, (vr) => vr.house)
  viewingRequests: ViewingRequest[];
}
