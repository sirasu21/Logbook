package db

import "github.com/go-redis/redis"	

func InitRedis() *redis.Client{
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379", // コンテナの名前:ポート番号
	})


	_, err := client.Ping().Result()
	if err != nil {
		panic(err)
	}

	return client
}