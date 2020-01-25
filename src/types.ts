export interface ConsulConsensusResult {
    leaderIP: string
    peerIPs: Array<string>
}

export interface ConsulNode {
    ID: string
    Node: string
    Address: string
}

export enum ConsulNodeType {
    Master = 'master',
    Slave = 'slave',
    Unknown = 'unknown'
}

export interface EnhancedConsulNode extends ConsulNode {
    type: ConsulNodeType
    apiAddress: string 
}