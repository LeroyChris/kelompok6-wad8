package dto

type APIResponse struct {
	Code    int         `json:"code"`
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func BuildResponse(code int, status string, message string, data interface{}) APIResponse {
	return APIResponse{
		Code:    code,
		Status:  status,
		Message: message,
		Data:    data,
	}
}