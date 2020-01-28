import { repeatUntilSuccess, repeatUntil } from './helpers'
import {
    getClusterConsensus,
    getConsulNodes,
    createAgentPolicy,
    createAgentToken,
    assignAgentTokens
} from './consul'
import {
    ConsulConsensusResult,
    EnhancedConsulNode,
    AgentPolicyResponse,
    AgentTokenResponse,
    AlreadyExistsError
} from './types'

export async function repeatUntilGetClusterConsensus(
    consulApi : string,
    consulDatacenter : string,
    consulAclToken : string,
    consensusCheckTimeout : number
) : Promise<ConsulConsensusResult> {
    return await repeatUntilSuccess("Reach consul cluster consensus", consensusCheckTimeout, async () => {
        return await getClusterConsensus(
            consulApi,
            consulDatacenter,
            consulAclToken
        )
    })
}


export async function repeatUntilGetConsulNodes(
    consulScheme : string,
    consulHost : string,
    consulPort : string,
    consulDatacenter : string,
    consulAclToken : string,
    clusterConsensus : ConsulConsensusResult,
    repeatTimeout : number
) : Promise<Array<EnhancedConsulNode>> {
    return await repeatUntilSuccess("Get consul cluster node information", repeatTimeout, async () => {
        return await getConsulNodes(
            consulScheme,
            consulHost,
            consulPort,
            consulDatacenter,
            consulAclToken,
            clusterConsensus
        )
    })
}

export async function repeatUntilCreateAgentPolicy(
    consulApi : string,
    consulDatacenter : string,
    consulAclToken : string,
    repeatTimeout : number,
) : Promise<AgentPolicyResponse> {
    return await repeatUntilSuccess("Create consul agent policy", repeatTimeout, async () => {
        return await createAgentPolicy(consulApi, consulDatacenter, consulAclToken)
    })
}

export async function repeatUntilCreateAgentToken(
    consulApi : string,
    consulAclToken : string,
    tokenAccessorId : string | null,
    tokenSecretId : string | null,
    agentPolicy : AgentPolicyResponse,
    repeatTimeout : number,
) : Promise<AgentTokenResponse> {
    return await repeatUntilSuccess("Create consul agent token", repeatTimeout, async () => {
        return await createAgentToken(consulApi, consulAclToken, tokenAccessorId, tokenSecretId, agentPolicy)
    })
}    

export async function repeatUntilAssignAgentTokens(
    consulAclToken : string,
    consulNodes : Array<EnhancedConsulNode>,
    agentToken : AgentTokenResponse,
    repeatTimeout : number
) {
    return await repeatUntilSuccess("Assign consul agent token", repeatTimeout, async () => {
        return await assignAgentTokens(consulAclToken, consulNodes, agentToken)
    })
}