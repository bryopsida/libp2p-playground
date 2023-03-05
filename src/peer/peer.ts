import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { floodsub } from '@libp2p/floodsub'
// import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { bootstrap } from '@libp2p/bootstrap'
import { kadDHT } from '@libp2p/kad-dht'
import { preSharedKey } from 'libp2p/pnet'

const swarmKey = Buffer.from(process.env.SWARM_KEY as string, 'base64')
const psk = preSharedKey({
  enabled: true,
  psk: swarmKey,
})

const createNode = () => {
  return createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0'],
    },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    pubsub: floodsub(),
    dht: kadDHT(),
    connectionProtector: psk,
    peerDiscovery: [
      bootstrap({
        list: [
          // a list of bootstrap peer multiaddrs to connect to on node startup
          `/ip4/${process.env.RELAY_IP}/tcp/32500/ipfs/${process.env.RELAY_PEER_ID}`,
        ],
        timeout: 1000, // in ms,
        tagName: 'bootstrap',
        tagValue: 50,
        tagTTL: 120000, // in ms
      }),
    ],
  })
}

const node = await createNode()
await node.start()

console.log('Started Node: ', node.peerId.toString())

node.addEventListener('peer:discovery', async (evt) => {
  try {
    if (
      evt.detail.id !== node.peerId &&
      node.getConnections(evt.detail.id).length === 0
    ) {
      console.log('Discovered peer: ', evt.detail.id.toString())
      await node.dial(evt.detail.id)
      console.log('Connected to peer: ', evt.detail.id.toString())
      console.log('Ping: ', await node.ping(evt.detail.id))
    }
  } catch (err) {
    console.error('Error in discovery handler: ', err)
  }
})
node.pubsub.subscribe('greet')

const printMsg = (msg: any) => {
  console.log('Sub Msg Event: ', msg)
  console.log('From: ', msg.detail.from)
  console.log('Msg: ', Buffer.from(msg.detail.data).toString())
  console.log('Topic: ', msg.detail.topic)
}

node.pubsub.addEventListener('message', async (evt) => {
  printMsg(evt)
  if (
    evt.detail.topic === 'greet' &&
    evt.detail.from !== node.peerId &&
    Buffer.from(evt.detail.data).toString() === 'Hello world'
  ) {
    try {
      await node.pubsub.publish(
        'greet',
        Buffer.from(`Hello ${evt.detail.from}`)
      )
    } catch (err) {
      console.error('error while publishing respond: ', err)
    }
  }
})

const timer = setInterval(async () => {
  try {
    await node.pubsub.publish('greet', Buffer.from('Hello world'))
  } catch (err) {
    console.error('error while publishing: ', err)
  }
}, 10000)

console.log('Swarm Key: ', swarmKey.toString('base64'))
process.on('SIGINT', async () => {
  clearInterval(timer)
  await node.stop()
})
