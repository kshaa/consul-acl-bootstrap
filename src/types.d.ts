export interface ConsulConsensusResult {
    leaderIP: string
    peerIPs: Array<string>
}


export interface ConsulNode {
    ID: string
    Node: string
    Address: string
}

export enum MasterOrSlave {
    Master = 'master',
    Slave = 'slave'
}

export interface TypedConsulNode extends ConsulNode {
    type: MasterOrSlave
}