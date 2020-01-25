#!/usr/bin/env ts-node
import {
    createConsulApiAddress,
    reachClusterConsensus,
    findConsulNodes,
    createAgentPolicy,
    createAgentToken,
    assignAgentTokens
} from './helpers'
import { EnhancedConsulNode, ConsulConsensusResult } from 'types';

async function main() {
    const consulScheme = process.env['CONSUL_SCHEME'] || 'http'
    const consulHost = process.env['CONSUL_HOST']
    const consulPort = process.env['CONSUL_PORT'] || '8500'
    const consensusCheckTimeout = Number(process.env['CONSENSUS_CHECK_TIMEOUT_MS']) || 5000
    const consulDatacenter = process.env['CONSUL_DATACENTER'] || 'dc1'
    const consulAclToken = process.env['CONSUL_ACL_TOKEN'] || '' // Most likely management token
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)

    if (!consulHost) throw Error('Consul host not configured, use CONSUL_HOST')
    
    console.log('Will try to bootstrap Consul agent ACL tokens.')
    console.log(`Will try to reach Consul datacenter '${consulDatacenter}' at address '${consulApi}'`)
    
    // Wait until cluster reached consensus
    const clusterConsensus : ConsulConsensusResult = await reachClusterConsensus(
        consulApi,
        consulDatacenter,
        consulAclToken,
        consensusCheckTimeout
    )

    // Get nodes with master/slave info
    const consulNodes : Array<EnhancedConsulNode> = await findConsulNodes(
        consulScheme,
        consulHost,
        consulPort,
        consulDatacenter,
        consulAclToken,
        clusterConsensus
    )

    // Log node info
    console.log('Found the following cluster nodes:')
    for (let node of consulNodes) {
        console.log(`Node ${node.Node} has role ${node.type}. ID: ${node.ID}`)
    }

    // Create agent policy
    const agentPolicy = await createAgentPolicy(
        consulApi,
        consulDatacenter,
        consulAclToken
    )

    // Create agent token
    const agentToken = await createAgentToken(
        consulApi,
        consulAclToken,
        agentPolicy
    )

    // Assign all agents the created token
    await assignAgentTokens(
        consulAclToken,
        consulNodes,
        agentToken
    )

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