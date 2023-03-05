import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
// import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { mdns } from '@libp2p/mdns'
import { kadDHT } from '@libp2p/kad-dht'
import { preSharedKey, generateKey } from 'libp2p/pnet'
import { floodsub } from '@libp2p/floodsub'

const swarmKey = process.env.SWARM_KEY
  ? Buffer.from(process.env.SWARM_KEY, 'base64')
  : Buffer.alloc(95)
if (process.env.SWARM_KEY == null) {
  generateKey(swarmKey)
}
const createNode = () => {
  return createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/32500'],
    },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    pubsub: floodsub(),
    dht: kadDHT(),
    connectionProtector: preSharedKey({
      enabled: true,
      psk: swarmKey,
    }),
    relay: {
      enabled: true,
      hop: {
        enabled: true
      },
      advertise: {
        enabled: true
      }
    },
    peerDiscovery: [
      mdns({
        interval: 20e3,
      }),
    ],
  })
}

const node = await createNode()
await node.start()

node.addEventListener('peer:connect', (evt) => {
  console.log('Peer Connected: ', evt.detail.id.toString())
})

node.addEventListener('peer:discovery', (evt) => {
  console.log('Peer Discovered: ', evt.detail.id.toString())
})

node.addEventListener('peer:disconnect', (evt) => {
  console.log('Peer Disconnected: ', evt.detail.id.toString())
})

console.log('Started Relay Node: ', node.peerId.toString())

console.log('Swarm Key: ', swarmKey.toString('base64'))

process.on('SIGINT', async () => {
  await node.stop()
})
