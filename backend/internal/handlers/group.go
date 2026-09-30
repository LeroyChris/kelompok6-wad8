package handlers

import (
	"github.com/gin-gonic/gin"
)

// Legacy alias handlers untuk backwards-compatibility frontend

func CreateGroup(c *gin.Context) {
	CreateCircle(c)
}

func GetGroupDetail(c *gin.Context) {
	GetCircleDetail(c)
}

func JoinGroup(c *gin.Context) {
	JoinCircle(c)
}
