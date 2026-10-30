import { createClient } from 'redis';

const redisClient = createClient({
    username: 'default',
    password: 'GPGHlEyhZgMXUBfEELNFJe3KwUWeqri6',
    socket: {
        host: 'redis-19729.c212.ap-south-1-1.ec2.cloud.redislabs.com',
        port: 19729
    }
});

redisClient.on('error', err => console.log('Redis Client Error', err));

await redisClient.connect();

await redisClient.set('foo', 'bar');
const result = await redisClient.get('foo');
console.log(result)  // >>> bar


export default redisClient;