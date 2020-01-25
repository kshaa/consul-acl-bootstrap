#!/usr/bin/env ts-node
import {
    createConsulApiAddress,
    reachClusterConsensus,
    findConsulNodes
} from './helpers'
import { EnhancedConsulNode, ConsulConsensusResult } from 'types';

async function main() {
    const consulScheme = process.env['CONSUL_SCHEME'] || 'http'
    const consulHost = process.env['CONSUL_HOST']
    const consulPort = process.env['CONSUL_PORT'] || '8500'
    const consensusCheckTimeout = Number(process.env['CONSENSUS_CHECK_TIMEOUT_MS']) || 5000
    const consulDatacenter = process.env['CONSUL_DATACENTER'] || 'dc1'
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)

    if (!consulHost) throw Error('Consul host not configured, use CONSUL_HOST')
    
    console.log('Will try to bootstrap Consul agent ACL tokens.')
    console.log(`Will try to reach Consul datacenter '${consulDatacenter}' at address '${consulApi}'`)
    const clusterConsensus : ConsulConsensusResult = await reachClusterConsensus(
        consulScheme,
        consulHost,
        consulPort,
        consulDatacenter,
        consensusCheckTimeout
    )
    
    // Make this timeout also
    const clusterNodes : Array<EnhancedConsulNode> = await findConsulNodes(
        consulScheme,
        consulHost,
        consulPort,
        consulDatacenter,
        clusterConsensus
    )

    console.log('Found the following cluster nodes:')
    for (let node of clusterNodes) {
        console.log(`Node ${node.Node} has role ${node.type}. ID: ${node.ID}`)
    }

    // Create one agent policy & token
    // Assign all agents the created token

}

main()