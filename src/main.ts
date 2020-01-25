#!/usr/bin/env ts-node
import {
    createConsulApiAddress,
    reachClusterConsensus,
    // findConsulAgents
} from './helpers'

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
    const clusterConsensus = await reachClusterConsensus(
        consulScheme,
        consulHost,
        consulPort,
        consulDatacenter,
        consensusCheckTimeout
    )
    // Make this timeout also
    // const clusterAgents = await findConsulAgents(
    //     consulScheme,
    //     consulHost,
    //     consulPort,
    //     consulDatacenter,
    //     clusterConsensus
    // )
    // console.log('Found the following cluster agents:')
    // for (let node of nodes) {
        // console.log(`Node `)
        // Inform who's the leader
    // }

    // Create one agent policy & token
    // Assign all agents the created token

}

main()