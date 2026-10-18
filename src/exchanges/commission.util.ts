import { EntityManager } from 'typeorm';
import {
  HouseAgent,
  HouseAgentStatus,
} from '../houses/entities/house-agent.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import {
  CommissionRecord,
  CommissionType,
} from './entities/commission-record.entity';

export interface RecordCommissionInput {
  houseId: string;
  /** TenantProfile id of the tenant who moved in. */
  tenantProfileId: string;
  /** Monthly rent the commission is a percentage of. */
  monthlyRent: number;
  type: CommissionType;
  exchangeRequestId?: string;
  /**
   * The house-agent assignment that handled the deal (e.g. the agent who ran
   * the viewing). Falls back to the house's active primary agent.
   */
  houseAgentId?: string | null;
  currency?: string;
}

export interface RecordedCommission {
  record: CommissionRecord;
  agentProfileId: string;
  rate: number;
  amount: number;
}

/**
 * Records the managing agent's commission for a tenant moving into a house.
 *
 * Commission = monthly rent x rate%, where the rate is the owner-agreed rate on
 * the house assignment, or the agent's default rate. Returns null when the
 * house has no active agent (owner handled it directly).
 *
 * Must run inside the caller's transaction.
 */
export async function recordAgentCommission(
  manager: EntityManager,
  input: RecordCommissionInput,
): Promise<RecordedCommission | null> {
  const houseAgentRepository = manager.getRepository(HouseAgent);
  const agentProfileRepository = manager.getRepository(AgentProfile);
  const commissionRepository = manager.getRepository(CommissionRecord);

  let assignment: HouseAgent | null = null;
  if (input.houseAgentId) {
    assignment = await houseAgentRepository.findOne({
      where: {
        id: input.houseAgentId,
        houseId: input.houseId,
        status: HouseAgentStatus.ACTIVE,
      },
    });
  }
  if (!assignment) {
    assignment = await houseAgentRepository.findOne({
      where: {
        houseId: input.houseId,
        isPrimary: true,
        status: HouseAgentStatus.ACTIVE,
      },
    });
  }
  if (!assignment) return null;

  const agentProfile = await agentProfileRepository.findOne({
    where: { id: assignment.agentId },
  });
  if (!agentProfile) return null;

  const rate = Number(
    assignment.customCommissionRate ?? agentProfile.commissionRate ?? 0,
  );
  const amount = Math.round(Number(input.monthlyRent || 0) * rate) / 100;

  const record = await commissionRepository.save(
    commissionRepository.create({
      houseId: input.houseId,
      agentId: agentProfile.id,
      tenantId: input.tenantProfileId,
      type: input.type,
      amount,
      currency: input.currency ?? 'TZS',
      exchangeRequestId: input.exchangeRequestId,
    }),
  );

  await agentProfileRepository.increment(
    { id: agentProfile.id },
    'totalCompletedDeals',
    1,
  );
  await houseAgentRepository.increment(
    { id: assignment.id },
    'dealsCompleted',
    1,
  );

  return { record, agentProfileId: agentProfile.id, rate, amount };
}
