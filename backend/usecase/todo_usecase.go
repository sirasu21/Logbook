package usecase

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

var (
	ErrBadRequest = errors.New("bad request")
	ErrNotFound   = errors.New("not found")
)

type TodoUsecase interface {
    ListByUser(ctx context.Context, lineUserID string) ([]models.Todo, error)
    Create(ctx context.Context, lineUserID, content string) (models.Todo, error)
    UpdateContent(ctx context.Context, lineUserID, idStr, content string) (models.Todo, error)
	Delete(ctx context.Context, lineUserID, idStr string) error
}

type todoUsecase struct {
    repo repository.TodoRepository
}

func NewTodoUsecase(repo repository.TodoRepository) TodoUsecase {
    return &todoUsecase{repo: repo}
}

func (u *todoUsecase) ListByUser(ctx context.Context, lineUserID string) ([]models.Todo, error) {
    return u.repo.FindByLineUserID(ctx, lineUserID)
}

func (u *todoUsecase) Create(ctx context.Context, lineUserID, content string) (models.Todo, error) {
    content = strings.TrimSpace(content)
    if lineUserID == "" {
        return models.Todo{}, fmt.Errorf("missing user id")
    }
    if content == "" || len(content) > 500 {
        return models.Todo{}, fmt.Errorf("content is required (<= 500 chars)")
    }

    t := models.Todo{
        LineUserID: lineUserID,
        Content:    content,
        // CreatedAt/UpdatedAt は GORM が自動で入れるので通常は不要
    }
    if err := u.repo.Create(ctx, &t); err != nil {
        return models.Todo{}, err
    }
    return t, nil
}

func (u *todoUsecase) UpdateContent(ctx context.Context, lineUserID, idStr, content string) (models.Todo, error) {
	if lineUserID == "" {
		return models.Todo{}, fmt.Errorf("%w: missing user id", ErrBadRequest)
	}
	idu, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || idu == 0 {
		return models.Todo{}, fmt.Errorf("%w: invalid id", ErrBadRequest)
	}
	id := uint(idu)

	content = strings.TrimSpace(content)
	if content == "" {
		return models.Todo{}, fmt.Errorf("%w: content is required", ErrBadRequest)
	}
	if len(content) > 500 {
		return models.Todo{}, fmt.Errorf("%w: content too long", ErrBadRequest)
	}

	t, err := u.repo.GetByIDAndUser(ctx, id, lineUserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Todo{}, ErrNotFound
		}
		return models.Todo{}, err
	}

	t.Content = content
	if err := u.repo.Update(ctx, &t); err != nil {
		return models.Todo{}, err
	}
	return t, nil
}

func (u *todoUsecase) Delete(ctx context.Context, lineUserID, idStr string) error {
	if lineUserID == "" {
		return fmt.Errorf("%w: missing user id", ErrBadRequest)
	}
	idu, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || idu == 0 {
		return fmt.Errorf("%w: invalid id", ErrBadRequest)
	}
	id := uint(idu)

	n, err := u.repo.DeleteByIDAndUser(ctx, id, lineUserID)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}