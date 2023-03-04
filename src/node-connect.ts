import { createLibp2p } from 'libp2p'
import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'

const createNode = () => {
  return createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0'],
    },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    peerDiscovery: [
      mdns({
        interval: 20e3,
      }),
    ],
  })
}

const [node1, node2] = await Promise.all([createNode(), createNode()])
node1.start()
node2.start()

node1.addEventListener('peer:discovery', async (evt) => {
  if (evt.detail.id.toString() !== node1.peerId.toString()) {
    console.log('Discovered:', evt.detail.id.toString())
    const conn = await node1.dial(evt.detail.id)
    console.log('Connected: ', conn)
    console.log('Ping: ', await node1.ping(evt.detail.id))
  }
})

process.on('SIGINT', () => {
  node1.stop()
  node2.stop()
  node1.removeEventListener('peer:discovery')
  node2.removeEventListener('peer:discovery')
})
