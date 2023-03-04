import { createLibp2p } from 'libp2p'
import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'

const createNode = () => {
  return createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0'],
    },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    pubsub: gossipsub(),
    peerDiscovery: [
      mdns({
        interval: 20e3,
      }),
    ],
  })
}

const [node1, node2] = await Promise.all([createNode(), createNode()])
let pubTimer: any
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

// TODO: isolate stream reset issue
process.nextTick(() => {
  pubTimer = setInterval(() => {
    node2.pubsub.publish('test', Buffer.from('hello world'))
  }, 1000)

  node1.pubsub.subscribe('test')
  node2.pubsub.subscribe('test')

  const printMsg = (msg: any) => {
    console.log('Sub Msg Event: ', msg)
    console.log('From: ', msg.detail.from)
    console.log('Msg: ', msg.detail.data.toString())
    console.log('Topic: ', msg.detail.topic)
  }

  node1.pubsub.addEventListener('message', (msg) => {
    try {
      printMsg(msg)
      if (msg.detail.from !== node1.peerId.toString()) {
        node1.pubsub.publish(
          msg.detail.topic,
          Buffer.from(`Hello ${msg.detail.from}`)
        )
      }
    } catch (err) {
      console.error('error while handling message', err)
    }
  })

  node2.pubsub.addEventListener('message', (msg) => {
    try {
      printMsg(msg)
    } catch (err) {
      console.error('error while handling message', err)
    }
  })
})

process.on('SIGINT', () => {
  clearInterval(pubTimer)
  node1.stop()
  node2.stop()
  node1.removeEventListener('peer:discovery')
  node2.removeEventListener('peer:discovery')
})
