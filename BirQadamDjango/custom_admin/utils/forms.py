from typing import Any
from django import forms
from core.models import Project, User  # Изменили CustomUser на User
from django.core.validators import RegexValidator
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm, UserChangeForm

class ProjectForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['title', 'description', 'city', 'status', 'latitude', 'longitude']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 5}),
            'city': forms.TextInput(attrs={'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'latitude': forms.HiddenInput(),
            'longitude': forms.HiddenInput(),
        }


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('name', 'email', 'password1', 'password2', 'role')

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields['name'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Имя'})
        self.fields['email'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Email'})
        self.fields['password1'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Пароль'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Подтвердите пароль'})
        self.fields['role'].widget.attrs.update({'class': 'form-control'})

class CustomLoginForm(AuthenticationForm):
    class Meta:
        fields = ('email', 'password')

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Email'})
        self.fields['password'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Пароль'})

class CustomUserChangeForm(UserChangeForm):
    phone_number = forms.CharField(
        max_length=15,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': '+7 (___) ___-__-__'})
    )
    avatar = forms.ImageField(
        required=False,
        widget=forms.FileInput(attrs={'class': 'form-control', 'accept': 'image/*'})
    )

    class Meta:
        model = User
        fields = ('name', 'email')

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # Убираем поле password из формы
        if 'password' in self.fields:
            del self.fields['password']
        # Устанавливаем начальное значение для phone_number
        if self.instance and self.instance.phone_number:
            self.fields['phone_number'].initial = self.instance.phone_number
        # Настраиваем виджеты
        self.fields['name'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Имя'})
        self.fields['email'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Email'})

    def save(self, commit: bool = True) -> User:  # type: ignore[override]
        user = super().save(commit=False)
        user.phone_number = self.cleaned_data.get('phone_number')
        if self.cleaned_data.get('avatar'):
            user.avatar = self.cleaned_data['avatar']
        if commit:
            user.save()
        return user