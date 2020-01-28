#!/usr/bin/env ts-node
import {
    createConsulApiAddress,
} from './lib/helpers'
import {
    repeatUntilGetClusterConsensus,
    repeatUntilCreateAgentPolicy,
    repeatUntilCreateAgentToken,
} from './lib/consulRepeat'

async function main() {
    const consulScheme = process.env['CONSUL_SCHEME'] || 'http'
    const consulHost = process.env['CONSUL_HOST']
    const consulPort = process.env['CONSUL_PORT'] || '8500'
    const pollingTimeout = Number(process.env['POLLING_TIMEOUT_MS']) || 5000
    const consulDatacenter = process.env['CONSUL_DATACENTER'] || 'dc1'
    const consulMgmtToken = process.env['CONSUL_MANAGEMENT_TOKEN_SECRET_ID'] || ''
    const tokenAccessorId = process.env['CONSUL_TOKEN_ACCESSOR_ID']
    const tokenSecretId = process.env['CONSUL_TOKEN_SECRET_ID']
    const aclDescription = process.env['CONSUL_ACL_DESCRIPTION'] || 'ACL without description, bootstrapped using kshaa/consul-acl-bootstrap'
    const policyPath = process.env['CONSUL_POLICY_PATH']
    const policyName = process.env['CONSUL_POLICY_NAME']
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)

    if (!consulMgmtToken) throw Error('Consul management token secret not configured, use CONSUL_MANAGEMENT_TOKEN_SECRET_ID')
    if (!consulHost) throw Error('Consul host not configured, use CONSUL_HOST')
    if (!policyPath) throw Error('Consul policy path not configured, use CONSUL_POLICY_PATH')
    if (!policyName) throw Error('Consul policy name not configured, use CONSUL_POLICY_NAME')
    if (!tokenAccessorId) throw Error('Consul token accessor id not configured, use CONSUL_TOKEN_ACCESSOR_ID')
    if (!tokenSecretId) throw Error('Consul token secret id not configured, use CONSUL_TOKEN_SECRET_ID')
    
    console.log('Bootstrapping custom Consul ACL policy & token.')
    console.log(`Attempting to reach Consul datacenter '${consulDatacenter}' at address '${consulApi}'`)
    
    // Wait until cluster reached consensus (I.e. Consul is ready for requests)
    await repeatUntilGetClusterConsensus(
        consulApi,
        consulDatacenter,
        consulMgmtToken,
        pollingTimeout
    )

    // Create agent policy
    await repeatUntilCreateAgentPolicy(
        // Access
        consulApi,
        consulDatacenter,
        consulMgmtToken,
        // Content
        policyPath,
        policyName,
        aclDescription,
        // Retries
        pollingTimeout
    )

    // Create agent token
    await repeatUntilCreateAgentToken(
        // Access
        consulApi,
        consulMgmtToken,
        // Content
        tokenAccessorId,
        tokenSecretId,
        policyName,
        aclDescription,
        // Retries
        pollingTimeout
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