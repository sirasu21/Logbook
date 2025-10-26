package db

import "github.com/go-redis/redis"	

func InitRedis() *redis.Client{
	client := redis.NewClient(&redis.Options{
		Addr:     "redis:6379", // コンテナの名前:ポート番号
		Password: "",
		DB:       0,
	})


	_, err := client.Ping().Result()
	if err != nil {
		panic(err)
	}

	return client
}