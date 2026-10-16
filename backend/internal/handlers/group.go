package handlers

import (
	"github.com/gin-gonic/gin"
)


func (h *CircleHandler) CreateGroup(c *gin.Context) {
	h.CreateCircle(c)
}

func (h *CircleHandler) GetGroupDetail(c *gin.Context) {
	h.GetCircleDetail(c)
}

func (h *CircleHandler) JoinGroup(c *gin.Context) {
	h.JoinCircle(c)
}