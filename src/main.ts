#!/usr/bin/env ts-node
import {
    createConsulApiAddress,
} from './lib/helpers'
import {
    repeatUntilGetClusterConsensus,
    repeatUntilGetConsulNodes,
    repeatUntilCreateAgentPolicy,
    repeatUntilCreateAgentToken,
    repeatUntilAssignAgentTokens
} from './lib/consulRepeat'
import { EnhancedConsulNode, ConsulConsensusResult } from 'lib/types';

async function main() {
    const consulScheme = process.env['CONSUL_SCHEME'] || 'http'
    const consulHost = process.env['CONSUL_HOST']
    const consulPort = process.env['CONSUL_PORT'] || '8500'
    const pollingTimeout = Number(process.env['POLLING_TIMEOUT_MS']) || 5000
    const consulDatacenter = process.env['CONSUL_DATACENTER'] || 'dc1'
    const consulAclToken = process.env['CONSUL_ACL_TOKEN'] || '' // Most likely management token
    const tokenAccessorId =  process.env['CONSUL_AGENT_ACCESSOR_ID']
    const tokenSecretId = process.env['CONSUL_AGENT_SECRET_ID']
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)

    if (!consulHost) throw Error('Consul host not configured, use CONSUL_HOST')
    
    console.log('Will try to bootstrap Consul agent ACL tokens.')
    console.log(`Will try to reach Consul datacenter '${consulDatacenter}' at address '${consulApi}'`)
    
    // Wait until cluster reached consensus
    const clusterConsensus : ConsulConsensusResult = await repeatUntilGetClusterConsensus(
        consulApi,
        consulDatacenter,
        consulAclToken,
        pollingTimeout
    )

    // Get nodes with master/slave info
    const consulNodes : Array<EnhancedConsulNode> = await repeatUntilGetConsulNodes(
        consulScheme,
        consulHost,
        consulPort,
        consulDatacenter,
        consulAclToken,
        clusterConsensus,
        pollingTimeout
    )

    // Log node info
    console.log('Found the following cluster nodes:')
    for (let node of consulNodes) {
        console.log(`Node ${node.Node} has role ${node.type}. ID: ${node.ID}`)
    }

    // Create agent policy
    const agentPolicy = await repeatUntilCreateAgentPolicy(
        consulApi,
        consulDatacenter,
        consulAclToken,
        pollingTimeout
    )

    // Create agent token
    const agentToken = await repeatUntilCreateAgentToken(
        consulApi,
        consulAclToken,
        tokenAccessorId,
        tokenSecretId,
        agentPolicy,
        pollingTimeout
    )

    // If tokenSecretId is provided, then I'm supposing that you've already
    // assigned the secret id in consul node configuration and assigning it
    // through API isn't necessary
    if (tokenSecretId === null) {
        // Assign all agents the created token
        await repeatUntilAssignAgentTokens(
            consulAclToken,
            consulNodes,
            agentToken,
            pollingTimeout
        )
    }

    // Report on success
    console.log('Finished agent ACL token bootstrap')
}

main().catch(error => {
    console.log(
        `Failed to bootstrap agent ACL tokens. ` +
        `Reason: ${error.message}\n`
    )
    throw error
})